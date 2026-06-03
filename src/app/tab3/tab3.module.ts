import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Tab3Page } from './tab3.page';
import { PlaceCardComponent } from '../shared/place-card/place-card.component';
import { Tab3PageRoutingModule } from './tab3-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule,
    PlaceCardComponent,
    Tab3PageRoutingModule,
  ],
  declarations: [Tab3Page]
})
export class Tab3PageModule {}
