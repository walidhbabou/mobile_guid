// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiGatewayUrl: 'http://localhost:8081',
  authServiceUrl: 'http://localhost:8081',
  // On a real Android device, localhost targets the phone itself.
  // Update this LAN IP if your machine address changes.
  nativeApiGatewayUrl: 'http://192.168.1.106:8081',
  nativeAuthServiceUrl: 'http://192.168.1.106:8081',
  googleMapsApiKey: ''
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
