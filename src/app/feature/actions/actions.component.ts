import {AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {assign, createMachine} from "xstate";
import {InterpretedService, XstateAngular} from "xstate-angular";
import {fromEvent, Observable, Subject} from "rxjs";
import {map, shareReplay, switchMap, takeUntil, tap} from "rxjs/operators";

export interface DndStates {
  states: {
    idle: {};
    dragging: {};
  }
}

export interface DnDContext {
  dx: number;
  dy: number;
  boxPosition: { x: number, y: number }
  point: { x: number, y: number },
}

const dndMachine = createMachine({
  id: 'dnd',
  initial: 'idle',
  context: {
    point: {x: 0, y: 0},
    dx: 0,
    dy: 0,
    boxPosition: {x: 0, y: 0}
  },
  states: {
    idle: {
      on: {
        MOUSE_DOWN: {
          target: 'dragging',
          actions: assign({point: (context, event: MouseDownEvent) => ({x: event.clientX, y: event.clientY})}),
        },
      }
    },
    dragging: {
      entry: ['onDraggingEntry'],
      exit: ['onDraggingExit'],
      on: {
        MOUSE_UP: {
          target: 'idle',
          actions: assign<DnDContext, DnDMachineEvents>({
            boxPosition: (ctx: DnDContext, _) => ({x: ctx.boxPosition.x + ctx.dx, y: ctx.boxPosition.y + ctx.dy}),
            point: (ctx, _) => ({x: ctx.point.x + ctx.dx, y: ctx.point.y + ctx.dy}),
            dx: 0,
            dy: 0
          })
        },
        MOUSE_MOVE: {
          actions: assign<DnDContext, DnDMachineEvents>({
            dx: (ctx, event) => event.clientX - ctx.point.x,
            dy: (ctx, event) => event.clientY - ctx.point.y,
          })
        }
      }
    },
  }
})

export class MouseDownEvent {
  readonly type = 'MOUSE_DOWN'

  constructor(public clientX: number, public clientY: number) {
  }
}

export class MouseUpEvent {
  readonly type = 'MOUSE_UP'

  constructor(public clientX: number, public clientY: number) {
  }
}

export class MouseMoveEvent {
  readonly type = 'MOUSE_MOVE'

  constructor(public clientX: number, public clientY: number) {
  }
}

export type DnDMachineEvents = MouseDownEvent | MouseUpEvent | MouseMoveEvent

@Component({
  selector: 'app-actions',
  templateUrl: './actions.component.html',
  styleUrls: ['./actions.component.scss'],
  providers: [XstateAngular]
})
export class ActionsComponent implements OnInit, AfterViewInit {
  @ViewChild('box') box: ElementRef | undefined;
  service: InterpretedService<DnDContext, DndStates, DnDMachineEvents>
  currentState$: Observable<string> | undefined;
  clickPoint$: Observable<string> | undefined;
  boxPosition$: Observable<{ x: number, y: number }> | undefined;
  private draggingFinished$: Subject<void> = new Subject();
  private draggingStarted$: Subject<void> = new Subject();

  constructor(private readonly xState: XstateAngular<DnDContext, DndStates, DnDMachineEvents>,
              private ngZone: NgZone) {
    this.service = this.xState.useMachine(dndMachine, {
        actions: {
          onDraggingEntry: (_, event) => this.draggingStarted$.next(),
          onDraggingExit: (_, event) => this.draggingFinished$.next(),
        },
      }
    );
  }

  ngOnInit(): void {
    this.currentState$ = this.service.state$.pipe(map(s => s.value as string))
    this.clickPoint$ = this.service.state$.pipe(map(s => `x: ${s.context.point?.x ?? 0}, y: ${s.context.point?.y ?? 0}`))
    this.boxPosition$ = this.service.state$.pipe(
      map(s => s.context.boxPosition),
      shareReplay(1),
    );
  }

  onMouseUp({clientY, clientX}: MouseEvent) {
    this.service.send(new MouseUpEvent(clientX, clientY))
  }

  onMouseDown({clientY, clientX}: MouseEvent) {
    this.service.send(new MouseDownEvent(clientX, clientY))
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.draggingStarted$.pipe(
        switchMap(() => fromEvent<MouseEvent>(this.box?.nativeElement, 'mousemove').pipe(
          takeUntil(this.draggingFinished$),
          tap((event) => console.log("Dragging to: (%O,%O)", event.clientX, event.clientY), err => console.error(err), () => console.log("MOVE COMPLETED")),
          tap(({clientY, clientX}) => this.service.send(new MouseMoveEvent(clientX, clientY)))
        ))).subscribe()
    });
    this.service.state$.pipe(
      map(s => s.context),
      tap(context => {
        this.box?.nativeElement.style.setProperty('--dx', context.dx);
        this.box?.nativeElement.style.setProperty('--dy', context.dy);
        this.box?.nativeElement.style.setProperty('--x', context.boxPosition.x);
        this.box?.nativeElement.style.setProperty('--y', context.boxPosition.y);
      }),
    ).subscribe();
  }
}
