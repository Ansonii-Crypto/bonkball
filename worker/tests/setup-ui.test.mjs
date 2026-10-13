import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const setupFunction = source.split('\n').find(line => line.startsWith('function setupPersonalCode('));

for (const [label, response, expectedNavigation] of [
  ['confirmed setup signs in', {ok:true,session_token:'test-token'}, true],
  ['setup-required response cannot appear successful', {setup_required:true}, false]
]) test(label, async () => {
  const elements = { '#saveCode': {}, '#cancelCode': {}, '#err': {} };
  let navigated = false;
  const context = vm.createContext({
    render() {}, esc: value => value, codeHTML: () => '',
    V: {querySelectorAll: () => []},
    document: {querySelector: key => elements[key]},
    getCode: () => '123456', accounts() {},
    api: async () => response, admin: async () => {navigated = true;}
  });
  vm.runInContext(setupFunction, context);
  context.setupPersonalCode({id:'test',name:'Test'},'invitation');
  await elements['#saveCode'].onclick();
  assert.equal(navigated, expectedNavigation);
  if (!expectedNavigation) assert.match(elements['#err'].textContent, /not saved/);
  assert.equal(elements['#saveCode'].disabled,false);
});
