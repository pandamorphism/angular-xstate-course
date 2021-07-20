import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {createMachine} from "xstate";
import {InterpretedService, XstateAngular} from "xstate-angular";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

export interface ToggleState {
  states: {
    inactive: {}
    active: {}
  }
}

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        mousedown: {
          target: 'active'
        }
      }
    },
    active: {
      on: {
        mouseup: {
          target: 'inactive'
        }
      }
    },
  }
})

@Component({
  selector: 'toggle-state',
  templateUrl: './toggle-state.component.html',
  styleUrls: ['./toggle-state.component.scss'],
  providers: [XstateAngular]
})
export class ToggleStateComponent implements OnInit {
  service: InterpretedService<any, ToggleState>
  currentState$: Observable<string> | undefined;

  constructor(private readonly xState: XstateAngular<any, ToggleState>) {
    this.service = this.xState.useMachine(toggleMachine);
  }

  ngOnInit(): void {
    this.currentState$ = this.service.state$.pipe(map(s => s.value as string))
  }
}
