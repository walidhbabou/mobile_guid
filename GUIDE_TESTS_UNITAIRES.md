# Guide des tests unitaires

Ce fichier explique les nouveaux tests ajoutes dans le projet et comment les lire.

## Commandes utiles

- `npm test`
  Lance Karma en mode interactif.
- `npm run test:ci`
  Lance toute la suite une seule fois en mode headless.
- `npm run test:coverage`
  Lance les tests et genere un rapport de couverture dans `coverage/app`.

## Fichiers ajoutes

- `src/app/services/token.service.spec.ts`
  Teste le stockage des tokens, leur suppression et la verification d expiration.
- `src/app/services/auth.service.spec.ts`
  Teste la connexion, l inscription, le stockage du profil et la deconnexion.
- `src/app/services/api.service.spec.ts`
  Teste les appels HTTP, les headers, l upload de `FormData` et la gestion des erreurs.
- `src/app/services/place-catalog.service.spec.ts`
  Teste la normalisation des lieux, le fallback local, les filtres et les visites recentes.
- `src/app/services/ai-place.service.spec.ts`
  Teste la recherche IA, le retry entre endpoints, le fallback local et la recherche audio.
- `src/app/guards/auth.guard.spec.ts`
  Teste la protection des routes privees.
- `src/app/guards/guest.guard.spec.ts`
  Teste la redirection des utilisateurs deja connectes.

## Comment lire un test

La plupart des tests suivent la structure AAA:

1. Arrange
   On prepare les donnees, les mocks et les spies.
2. Act
   On appelle la methode a tester.
3. Assert
   On verifie le resultat attendu.

Exemple simple:

```ts
apiServiceSpy.login.and.returnValue(of(response));

service.login(credentials).subscribe();

expect(tokenServiceSpy.saveTokens).toHaveBeenCalledOnceWith(
  'access-token',
  'refresh-token'
);
```

## Ce qu il faut comprendre dans ce projet

- Un `spy` remplace une vraie dependance.
  Exemple: on remplace `ApiService` pour tester `AuthService` sans faire de vrai appel HTTP.
- `HttpTestingController` permet de verifier l URL, la methode HTTP et les headers.
- Les tests de services sont les plus interessants pour un CV.
  Ils montrent que tu sais verifier la logique metier, les erreurs et les cas limites.
- Les tests de guards montrent que tu sais proteger la navigation.
- Les tests de fallback sont utiles parce qu ils prouvent que l application reste robuste meme si une API tombe.

## Ce que tu peux dire dans ton CV

Tu peux decrire ce travail avec une phrase comme:

`Ajout de tests unitaires Angular/Jasmine/Karma pour les services critiques (authentification, appels API, recherche IA, navigation) avec mocks, spies et verification des cas d erreur.`

## Conseil pratique

Quand tu ajoutes un nouveau test:

1. Choisis une methode avec de la logique metier.
2. Teste un cas nominal.
3. Teste un cas d erreur ou un cas limite.
4. Verifie aussi les effets secondaires.
   Exemple: `localStorage`, redirection, headers HTTP, fallback local.
