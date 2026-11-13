import {chromium} from 'playwright';

export function launchTestBrowser(){
  const channel=process.env.STONEWAKE_BROWSER||(process.platform==='win32'?'msedge':'chromium');
  return chromium.launch({channel,headless:true,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
}
