import { Sex } from '@prisma/client';
import {
  ageInMonths,
  classifyCategory,
  cowEquivalent,
  EvAnimalInput,
} from './cow-equivalent';

const NOW = new Date('2026-07-01T00:00:00.000Z');
/** Devuelve una fecha de nacimiento hace `months` meses respecto de NOW. */
const bornMonthsAgo = (months: number): Date => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - months);
  return d;
};

const animal = (o: Partial<EvAnimalInput>): EvAnimalInput => ({
  sex: Sex.FEMALE,
  birthDate: bornMonthsAgo(40),
  ...o,
});

describe('cow-equivalent (EV)', () => {
  it('ageInMonths cuenta meses completos', () => {
    expect(ageInMonths(bornMonthsAgo(18), NOW)).toBe(18);
    expect(ageInMonths(NOW, NOW)).toBe(0);
  });

  describe('categoría por sexo + edad', () => {
    it('hembra <12m = ternera (0.60)', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(6) });
      expect(classifyCategory(a, NOW)).toBe('TERNERO');
      expect(cowEquivalent(a, NOW)).toBe(0.6);
    });

    it('hembra 12-30m = vaquillona de reposición (0.70)', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(20) });
      expect(classifyCategory(a, NOW)).toBe('VAQUILLONA');
      expect(cowEquivalent(a, NOW)).toBe(0.7);
    });

    it('vaca adulta sin cría = vaca seca (0.80)', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(48) });
      expect(cowEquivalent(a, NOW)).toBe(0.8);
    });

    it('macho <12m = ternero (0.60), 12-24m = novillito (0.70), >=24m = novillo (0.80)', () => {
      expect(cowEquivalent(animal({ sex: Sex.MALE, birthDate: bornMonthsAgo(8) }), NOW)).toBe(0.6);
      expect(cowEquivalent(animal({ sex: Sex.MALE, birthDate: bornMonthsAgo(18) }), NOW)).toBe(0.7);
      expect(cowEquivalent(animal({ sex: Sex.MALE, birthDate: bornMonthsAgo(30) }), NOW)).toBe(0.8);
    });
  });

  describe('overrides por metadata', () => {
    it('hasCalfAtFoot convierte a vaca con ternero al pie (1.00)', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(48), metadata: { hasCalfAtFoot: true } });
      expect(classifyCategory(a, NOW)).toBe('VACA_CON_TERNERO');
      expect(cowEquivalent(a, NOW)).toBe(1.0);
    });

    it('isBull marca al macho como toro (1.30)', () => {
      const a = animal({ sex: Sex.MALE, birthDate: bornMonthsAgo(40), metadata: { isBull: true } });
      expect(cowEquivalent(a, NOW)).toBe(1.3);
    });

    it('metadata.category explícita y válida tiene prioridad', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(6), metadata: { category: 'toro' } });
      expect(cowEquivalent(a, NOW)).toBe(1.3);
    });

    it('metadata.category inválida se ignora (cae a la inferencia)', () => {
      const a = animal({ sex: Sex.FEMALE, birthDate: bornMonthsAgo(20), metadata: { category: 'inexistente' } });
      expect(cowEquivalent(a, NOW)).toBe(0.7);
    });
  });
});
