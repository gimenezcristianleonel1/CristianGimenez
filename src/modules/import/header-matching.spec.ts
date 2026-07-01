import {
  hasRequiredFields,
  matchHeaders,
  normalizeSex,
  normalizeSpecies,
  signatureOf,
} from './header-matching';

describe('header-matching (fuzzy)', () => {
  it('mapea distintos sinónimos de caravana al campo tagId', () => {
    for (const header of ['N° Caravana', 'RP', 'Caravana', 'Id_Animal', 'Arete', 'CROTAL']) {
      const { mapping } = matchHeaders([header]);
      expect(mapping.tagId).toBe(header);
    }
  });

  it('mapea un encabezado completo con varios campos', () => {
    const headers = ['N° Caravana', 'Raza', 'Sexo', 'Fecha Nac.', 'Peso (Kg)', 'Especie'];
    const { mapping, unmatchedColumns } = matchHeaders(headers);
    expect(mapping.tagId).toBe('N° Caravana');
    expect(mapping.breed).toBe('Raza');
    expect(mapping.sex).toBe('Sexo');
    expect(mapping.birthDate).toBe('Fecha Nac.');
    expect(mapping.initialWeightKg).toBe('Peso (Kg)');
    expect(mapping.species).toBe('Especie');
    expect(unmatchedColumns).toHaveLength(0);
  });

  it('devuelve columnas sin mapear cuando los encabezados son desconocidos', () => {
    const { mapping, unmatchedColumns } = matchHeaders(['Columna X', 'Dato 1', 'Rareza']);
    expect(hasRequiredFields(mapping)).toBe(false);
    expect(unmatchedColumns).toEqual(['Columna X', 'Dato 1', 'Rareza']);
  });

  it('hasRequiredFields exige al menos la caravana', () => {
    expect(hasRequiredFields({ breed: 'Raza' })).toBe(false);
    expect(hasRequiredFields({ tagId: 'Caravana' })).toBe(true);
  });

  it('la firma es estable ante el orden de las columnas', () => {
    expect(signatureOf(['Caravana', 'Peso'])).toBe(signatureOf(['Peso', 'Caravana']));
    expect(signatureOf(['Caravana', 'Peso'])).not.toBe(signatureOf(['Caravana', 'Raza']));
  });

  it('normaliza especie y sexo a los enums', () => {
    expect(normalizeSpecies('Vacuno')).toBe('BOVINE');
    expect(normalizeSpecies('cerdo')).toBe('PORCINE');
    expect(normalizeSex('Macho')).toBe('MALE');
    expect(normalizeSex('H')).toBe('FEMALE');
  });
});
