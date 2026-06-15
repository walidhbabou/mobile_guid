export class PlaceDetailPage {
  get placeName() {
    return cy.get('.detail-topbar h1');
  }

  get placeLocation() {
    return cy.get('.detail-topbar p');
  }

  get favoriteButton() {
    return cy.get('.detail-topbar__actions .circle-button').eq(1);
  }

  get favoriteIcon() {
    return this.favoriteButton.find('ion-icon');
  }

  get backButton() {
    return cy.get('.detail-topbar .circle-button').first();
  }

  get mapButton() {
    return cy.get('.detail-topbar__actions .circle-button').first();
  }

  get reviewTextarea() {
    return cy.get('textarea[placeholder]');
  }

  get submitReviewButton() {
    return cy.get('.editor-actions ion-button');
  }

  get ratingChips() {
    return cy.get('.rating-chip');
  }

  get reviewMessage() {
    return cy.get('.review-form-card ~ .favorite-feedback p, .favorite-feedback p').last();
  }

  get audioPlayButton() {
    return cy.contains('ion-button', 'Lire audio');
  }

  get placeRating() {
    return cy.get('.rating-text strong').first();
  }

  toggleFavorite() {
    this.favoriteButton.click();
    return this;
  }

  goBack() {
    this.backButton.click();
    return this;
  }

  selectRating(stars: number) {
    this.ratingChips.eq(stars - 1).click();
    return this;
  }

  writeReview(comment: string) {
    this.reviewTextarea.clear().type(comment);
    return this;
  }

  submitReview() {
    this.submitReviewButton.click();
    return this;
  }
}
