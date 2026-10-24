import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'tmp/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/systems/RoomTransitionSystem.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `NewExpression[callee.name='RewardPickup']`,
          message:
            'Use RoomTransitionSystem.spawnPersistentReward() so floor pickups survive room transitions.',
        },
      ],
    },
  },
);
