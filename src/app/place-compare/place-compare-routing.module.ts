import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlaceComparePage } from './place-compare.page';

const routes: Routes = [{ path: '', component: PlaceComparePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PlaceComparePageRoutingModule {}
