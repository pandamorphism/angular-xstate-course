import {AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {assign, createMachine} from "xstate";
import {InterpretedService, XstateAngular} from "xstate-angular";
import {fromEvent, Observable, Subject} from "rxjs";
import {filter, map, shareReplay, switchMap, takeUntil, tap} from "rxjs/operators";
import {UntilDestroy, untilDestroyed} from "@ngneat/until-destroy";

export interface DndStates {
  states: {
    idle: {};
    dragging: {};
    draggedOut: {}
  }
}

export interface DnDContext {
  delta: { x: number, y: number },
  boxPosition: { x: number, y: number },
  point: { x: number, y: number },
  dragCount: number,
}

const initialContext = {
  point: {x: 0, y: 0},
  delta: {x: 0, y: 0},
  boxPosition: {x: 0, y: 0},
  dragCount: 0,
};
const dndMachine = createMachine({
  id: 'dnd',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        MOUSE_DOWN: [{
          target: 'dragging',
          actions: 'setPoint',
          cond: 'canDrag'
        }, {
          target: 'draggedOut',
          cond: 'canNotDrag'
        }]
      }
    },
    dragging: {
      entry: ['onDraggingEntry', 'increaseMove'],
      exit: ['onDraggingExit'],
      on: {
        MOUSE_UP: {
          target: 'idle',
          actions: 'draggingComplete',
        },
        MOUSE_MOVE: {
          actions: assign<DnDContext, MouseMoveEvent>({
            delta: (ctx, event) => ({
              x: event.clientX - ctx.point.x,
              y: event.clientY - ctx.point.y
            })
          })
        }
      }
    },
    draggedOut: {
      on: {
        ESC: {
          target: "idle",
          actions: assign(initialContext)
        },
      }
    }
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

export class Esc {
  readonly type = 'ESC'
}

export class MouseMoveEvent {
  readonly type = 'MOUSE_MOVE'

  constructor(public clientX: number, public clientY: number) {
  }
}

export type DnDMachineEvents = MouseDownEvent | MouseUpEvent | MouseMoveEvent | Esc
const MAX_MOVES = 5;

@UntilDestroy()
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
  movesLeft$: Observable<number> | undefined;
  clickPoint$: Observable<string> | undefined;
  boxPosition$: Observable<{ x: number, y: number }> | undefined;
  private draggingFinished$: Subject<void> = new Subject();
  private draggingStarted$: Subject<void> = new Subject();

  constructor(private readonly xState: XstateAngular<DnDContext, DndStates, DnDMachineEvents>,
              private ngZone: NgZone) {
    this.service = this.xState.useMachine(dndMachine, {
        actions: {
          onDraggingEntry: () => this.draggingStarted$.next(),
          onDraggingExit: () => this.draggingFinished$.next(),
          increaseMove: assign<DnDContext, DnDMachineEvents>((ctx) =>
            ({dragCount: ctx.dragCount + 1})),
          setPoint: assign<DnDContext, DnDMachineEvents>({
            point: (context, event) => {
              if (event.type === 'MOUSE_DOWN') return {
                x: event.clientX,
                y: event.clientY
              }; else throw Error(`Event ${event.type} is not supported`);
            },
          }),
          moving: assign<DnDContext, DnDMachineEvents>({
            delta: (ctx, event) => {
              if (event.type === 'MOUSE_MOVE')
                return ({
                  x: event.clientX - ctx.point.x,
                  y: event.clientY - ctx.point.y,
                });
              else throw Error('');
            }
          }),
          draggingComplete: assign<DnDContext, DnDMachineEvents>({
            boxPosition: (ctx: DnDContext, _) => ({
              x: ctx.boxPosition.x + ctx.delta.x,
              y: ctx.boxPosition.y + ctx.delta.y
            }),
            point: (ctx, _) => ({x: ctx.point.x + ctx.delta.x, y: ctx.point.y + ctx.delta.y}),
            delta: {x: 0, y: 0}
          })

        },
        guards: {
          canDrag: (ctx, _) => ctx.dragCount < MAX_MOVES,
          canNotDrag: (ctx, _) => ctx.dragCount >= MAX_MOVES
        }
      }
    );
  }

  ngOnInit(): void {
    this.movesLeft$ = this.service.state$.pipe(map(s => MAX_MOVES - s.context.dragCount));
    this.currentState$ = this.service.state$.pipe(map(s => s.value as string))
    this.clickPoint$ = this.service.state$.pipe(map(s => `x: ${s.context.point?.x ?? 0}, y: ${s.context.point?.y ?? 0}`))
    this.boxPosition$ = this.service.state$.pipe(
      map(s => s.context.boxPosition),
      shareReplay(1),
    );
    fromEvent<KeyboardEvent>(window.document.body, "keyup").pipe(
      filter(ev => ev.key === 'Escape'),
      tap(_ => this.service.send(new Esc())),
      untilDestroyed(this),
    ).subscribe()
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
          tap(({clientY, clientX}) => this.service.send(new MouseMoveEvent(clientX, clientY))),
          takeUntil(this.draggingFinished$),
        ))).subscribe()
    });
    this.service.state$.pipe(
      map(s => s.context),
      tap(ctx => console.log("CTX: %O", ctx)),
      tap(context => {
        this.box?.nativeElement.style.setProperty('--dx', context.delta.x);
        this.box?.nativeElement.style.setProperty('--dy', context.delta.y);
        this.box?.nativeElement.style.setProperty('--x', context.boxPosition.x);
        this.box?.nativeElement.style.setProperty('--y', context.boxPosition.y);
      }),
      untilDestroyed(this),
    ).subscribe();
  }
}
