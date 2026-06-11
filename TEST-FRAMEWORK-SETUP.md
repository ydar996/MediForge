# 🧪 TEST FRAMEWORK SETUP GUIDE

**Purpose:** Set up automated testing infrastructure to prevent regressions.

---

## 📦 PREREQUISITES

```bash
# Install Node.js (if not already installed)
# Download from: https://nodejs.org/

# Verify installation
node --version
npm --version
```

---

## 🚀 SETUP STEPS

### Step 1: Initialize Project

```bash
cd C:\Users\yinka\Documents\MediForge

# Initialize package.json (if not exists)
npm init -y
```

### Step 2: Install Testing Dependencies

```bash
# Install Jest (testing framework)
npm install --save-dev jest

# Install testing utilities for DOM manipulation
npm install --save-dev jest-environment-jsdom

# Install Supabase client for testing (if needed)
npm install --save-dev @supabase/supabase-js

# Optional: Code coverage
npm install --save-dev jest-coverage
```

### Step 3: Configure Jest

Create `jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.test.js',
    '!js/vendor/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

### Step 4: Create Test Setup File

Create `tests/setup.js`:

```javascript
// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock Supabase client (if needed)
global.supabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => Promise.resolve({ data: [], error: null })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
};

// Mock window objects
global.window = {
  location: {
    href: '',
    search: '',
  },
  console: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
};
```

### Step 5: Create Test Directory Structure

```bash
mkdir tests
mkdir tests/unit
mkdir tests/integration
mkdir tests/e2e
mkdir tests/regression
```

---

## 📝 EXAMPLE TEST FILES

### Example 1: Unit Test for Patient ID Resolution

Create `tests/unit/patients.test.js`:

```javascript
const { resolvePatientByIdentifier } = require('../../js/patients');

describe('Patient ID Resolution', () => {
  beforeEach(() => {
    // Reset mocks before each test
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
  });

  test('resolvePatientByIdentifier with UUID should return patient with legacy ID', async () => {
    // Mock patient data
    const mockPatients = [
      {
        id: 'MEC0012',
        _supabaseUuid: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'Test',
        lastName: 'Patient',
      },
    ];

    localStorage.getItem.mockReturnValue(JSON.stringify(mockPatients));

    const result = await resolvePatientByIdentifier('550e8400-e29b-41d4-a716-446655440000');

    expect(result).toBeDefined();
    expect(result.id).toBe('MEC0012'); // Should be legacy ID, not UUID
    expect(result._supabaseUuid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('resolvePatientByIdentifier with legacy ID should return patient', async () => {
    const mockPatients = [
      {
        id: 'MEC0012',
        _supabaseUuid: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'Test',
        lastName: 'Patient',
      },
    ];

    localStorage.getItem.mockReturnValue(JSON.stringify(mockPatients));

    const result = await resolvePatientByIdentifier('MEC0012');

    expect(result).toBeDefined();
    expect(result.id).toBe('MEC0012');
  });

  test('patient.id should NEVER be a UUID after resolution', async () => {
    const mockPatients = [
      {
        id: 'MEC0012',
        _supabaseUuid: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'Test',
        lastName: 'Patient',
      },
    ];

    localStorage.getItem.mockReturnValue(JSON.stringify(mockPatients));

    const result = await resolvePatientByIdentifier('550e8400-e29b-41d4-a716-446655440000');

    // Critical: patient.id must NOT be a UUID
    expect(result.id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(result.id).toBe('MEC0012');
  });
});
```

### Example 2: Integration Test for Patient Creation

Create `tests/integration/patient-flow.test.js`:

```javascript
describe('Patient Creation Flow', () => {
  test('Creating patient should save to Supabase first, then localStorage', async () => {
    // Mock Supabase success
    const supabaseInsert = jest.fn(() => Promise.resolve({
      data: [{ id: '550e8400-e29b-41d4-a716-446655440000', patient_id: 'MEC0013' }],
      error: null,
    }));

    global.supabaseClient.from = jest.fn(() => ({
      insert: supabaseInsert,
    }));

    // Simulate patient creation
    const patientData = {
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
    };

    // Call the actual function (you'll need to export it)
    // await createPatient(patientData);

    // Verify Supabase was called first
    expect(supabaseInsert).toHaveBeenCalled();

    // Verify localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});
```

### Example 3: Regression Test for Critical Workflows

Create `tests/regression/critical-workflows.test.js`:

```javascript
describe('Critical Workflows Regression Tests', () => {
  test('Patient ID resolution should work for both UUID and legacy ID', async () => {
    // This test ensures we don't break the most critical functionality
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const legacyId = 'MEC0012';

    // Test with UUID
    const result1 = await resolvePatientByIdentifier(uuid);
    expect(result1).toBeDefined();
    expect(result1.id).toBe(legacyId); // Should resolve to legacy ID

    // Test with legacy ID
    const result2 = await resolvePatientByIdentifier(legacyId);
    expect(result2).toBeDefined();
    expect(result2.id).toBe(legacyId);
  });

  test('Patient ID should NEVER be UUID in patient object', async () => {
    // Critical regression test
    const mockPatients = [
      {
        id: 'MEC0012',
        _supabaseUuid: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];

    localStorage.getItem.mockReturnValue(JSON.stringify(mockPatients));

    const result = await resolvePatientByIdentifier('550e8400-e29b-41d4-a716-446655440000');

    // This MUST always be true - if this fails, we've broken core functionality
    expect(result.id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
```

---

## 🏃 RUNNING TESTS

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Specific Test File

```bash
npm test -- tests/unit/patients.test.js
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

### Update package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:regression": "jest tests/regression"
  }
}
```

---

## 🔧 TESTING BROWSER-SPECIFIC CODE

For testing code that relies on browser APIs (DOM, localStorage, etc.), you'll need to mock them. The `jest-environment-jsdom` package provides this.

### Example: Testing DOM Manipulation

```javascript
describe('DOM Manipulation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test"></div>';
  });

  test('should update element', () => {
    const element = document.getElementById('test');
    element.textContent = 'Hello';
    expect(element.textContent).toBe('Hello');
  });
});
```

---

## 📊 CODE COVERAGE

Jest automatically generates coverage reports. View coverage in terminal or HTML:

```bash
# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html

# Open coverage/index.html in browser
```

---

## 🔗 CI/CD INTEGRATION

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run tests
      run: npm test

    - name: Generate coverage
      run: npm test -- --coverage

    - name: Upload coverage
      uses: codecov/codecov-action@v2
      with:
        files: ./coverage/lcov.info
```

---

## 🎯 BEST PRACTICES

1. **Write Tests First (TDD):**
   - Write failing test
   - Implement feature
   - Make test pass
   - Refactor

2. **Test Critical Paths:**
   - Focus on workflows that users depend on
   - Test edge cases and error scenarios

3. **Keep Tests Fast:**
   - Mock external dependencies (Supabase, localStorage)
   - Use fast test runners

4. **Test Behavior, Not Implementation:**
   - Test what the code does, not how it does it
   - Makes tests more maintainable

5. **Use Descriptive Test Names:**
   - Test names should describe what is being tested
   - Example: "resolvePatientByIdentifier with UUID should return patient with legacy ID"

---

## 🚨 COMMON ISSUES

### Issue: Tests fail due to missing global variables

**Solution:** Add mocks in `tests/setup.js`:

```javascript
global.window = window;
global.document = document;
```

### Issue: Can't import ES6 modules

**Solution:** Use Babel or configure Jest to handle ES6:

```javascript
// jest.config.js
module.exports = {
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
```

---

## 📚 NEXT STEPS

1. Set up test framework
2. Write tests for critical workflows (see CRITICAL-WORKFLOWS.md)
3. Run tests before every commit
4. Set up CI/CD to run tests automatically
5. Aim for 80%+ code coverage on critical modules

---

**Last Updated:** 2025-01-XX

