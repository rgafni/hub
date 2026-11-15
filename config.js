/* Roni hub config. No keys and no data in this repo. Each app's own server checks every request.
   CALLS_NEXT: show "Next call" from the Calls schedule list (Calls v10 callList, Roni's key only). */
window.HUB_CONFIG = {
  HOME_API: 'https://script.google.com/macros/s/AKfycbzsHxXV-3BnGaryFcevq2X496-8F64FHR9ak3LiUU4sljE-Rq6O02dLWa96EXEVQXMJ/exec',
  CALLS_API: 'https://script.google.com/macros/s/AKfycbzi_sFF-Nn1L_UGW16_GjWsVQpQ8XOQcc-n3iiD59ZEXygMSrRWWSM4pgM9dNY6ukET/exec',
  APPS: { home: '/home-ops/', work: '/ttg-recruiting/', ttg: '/ttg-ops/', calls: '/calls/', steadyWeb: '/steady/' },
  STEADY_PACKAGE: 'app.steady.parenting',
  CALLS_NEXT: true
};
