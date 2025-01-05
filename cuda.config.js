$ npm start

> nx8020webapp@1.0.0 start
> node --experimental-modules --es-module-specifier-resolution=node server.js

file:///D:/Repos/nx8020webapp/server.js:804
async function initializeLLM() {
^

SyntaxError: Identifier 'initializeLLM' has already been declared
    at compileSourceTextModule (node:internal/modules/esm/utils:338:16)
    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:102:18)
    at #translate (node:internal/modules/esm/loader:437:12)   
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:484:27)
    at async ModuleJob._link (node:internal/modules/esm/module_job:115:19)

Node.js v22.12.0import { GPU } from 'gpu.js';

export const gpuConfig = {
    deviceCount: 1,
    mainGpu: 0,
    useGpu: true
};

export async function checkGpuAvailability() {
    try {
        const gpu = new GPU();
        const isGPUAvailable = gpu.getMode() === 'gpu';
        
        if (!isGPUAvailable) {
            console.warn('GPU not available, falling back to CPU');
            return false;
        }
        
        console.log('GPU Backend initialized successfully');
        return true;
    } catch (error) {
        console.error('GPU check failed:', error);
        return false;
    }
}
