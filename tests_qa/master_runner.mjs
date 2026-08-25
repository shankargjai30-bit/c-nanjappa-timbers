import { runApiTests } from './test_api_integration.mjs';
import { runBrowserTests } from './test_e2e_browser.mjs';

async function runMasterSuite() {
  console.log('\n=============================================================');
  console.log('    TIMBERPRO ERP — MASTER AUTOMATED PRE-DELIVERY QA SUITE   ');
  console.log('=============================================================\n');

  const startTime = Date.now();

  const apiResults = await runApiTests();
  const browserResults = await runBrowserTests();

  const allResults = [...apiResults, ...browserResults];
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=============================================================');
  console.log('                     FINAL QA EXECUTION REPORT               ');
  console.log('=============================================================');
  console.log(`Total Automated Scenarios : ${allResults.length}`);
  console.log(`Passed                    : ${passed}`);
  console.log(`Failed                    : ${failed}`);
  console.log(`Execution Time            : ${elapsed}s`);
  console.log(`Status                    : ${failed === 0 ? 'ALL CHECKS PASSED (READY FOR CLIENT)' : 'FAILED'}`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runMasterSuite().catch(err => {
  console.error('Fatal master suite error:', err);
  process.exit(1);
});
