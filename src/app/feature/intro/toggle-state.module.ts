import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from "@angular/router";
import {ToggleStateComponent} from './toggle-state/toggle-state.component';


@NgModule({
  declarations: [
    ToggleStateComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{
      path: '',
      component: ToggleStateComponent
    }])
  ]
})
export class ToggleStateModule {
}
