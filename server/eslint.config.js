// ESLint flat config: typescript-eslint's recommended rules (PROJECT.md section 10.1).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'media', 'coverage'] },
  ...tseslint.configs.recommended,
);
