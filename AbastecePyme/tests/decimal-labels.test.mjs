import test from 'node:test';
import assert from 'node:assert/strict';
import * as Format from '../frontend/src/Api.js';
test('valid large decimal strings keep every digit in labels',()=>{
  assert.equal(Format.Money('9999999999999999.99'),'$\u00a09.999.999.999.999.999,99');
  assert.equal(Format.Quantity('99999999999999.9999'),'99.999.999.999.999,9999');
  assert.equal(Format.Money('1500.00'),'$\u00a01.500,00');
  assert.equal(Format.Quantity('0.1250'),'0,125');
});

