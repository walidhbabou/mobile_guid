import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PlaceComparePage } from './place-compare.page';
import { PlaceComparePageRoutingModule } from './place-compare-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule,
    PlaceComparePageRoutingModule,
  ],
  declarations: [PlaceComparePage],
})
export class PlaceComparePageModule {}
