import assert from 'node:assert/strict';
import {
  normalizePantryItems,
  pantryInventorySaveSchema,
  pantryItemsToText,
} from '../lib/pantry-inventory';

assert.equal(
  pantryInventorySaveSchema.safeParse({
    reviewConfirmed: false,
    items: [{ name: 'Eggs', quantity: '6', location: 'fridge' }],
  }).success,
  false,
  'Unreviewed AI results must never be accepted for saving',
);

const reviewed = pantryInventorySaveSchema.parse({
  reviewConfirmed: true,
  items: [
    { name: ' Eggs ', quantity: ' 6 ', location: 'fridge' },
    { name: 'eggs', quantity: null, location: 'unknown' },
    { name: 'Black beans', quantity: '2 cans', location: 'pantry' },
  ],
});

const normalized = normalizePantryItems(reviewed.items);
assert.deepEqual(normalized, [
  { name: 'Eggs', quantity: '6', location: 'fridge' },
  { name: 'Black beans', quantity: '2 cans', location: 'pantry' },
]);
assert.equal(pantryItemsToText(normalized), '6 Eggs, 2 cans Black beans');

console.log('Pantry inventory verification passed. Review is mandatory and duplicate items are merged.');
