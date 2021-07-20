import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
  {
    path: 'intro',
    loadChildren: () => import('./feature/intro/toggle-state.module').then(m => m.ToggleStateModule)
  },
  {
    path: 'actions',
    loadChildren: () => import('./feature/actions/actions.module').then(m => m.ActionsModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
