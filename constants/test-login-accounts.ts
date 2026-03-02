export type TestLoginAccount = {
  label: string;
  email: string;
  password: string;
  testID: string;
};

// Shared seeded test credentials for fast QA sign-in from the login screen.
export const TEST_LOGIN_ACCOUNTS: TestLoginAccount[] = [
  {
    label: "Trainer",
    email: "trainer@secretlab.com",
    password: "supertest",
    testID: "test-account-trainer",
  },
  {
    label: "Trainer2",
    email: "trainer2@secretlab.com",
    password: "supertest",
    testID: "test-account-trainer2",
  },
  {
    label: "Trainer3",
    email: "trainer3@secretlab.com",
    password: "supertest",
    testID: "test-account-trainer3",
  },
  {
    label: "Trainer4",
    email: "trainer4@secretlab.com",
    password: "supertest",
    testID: "test-account-trainer4",
  },
  {
    label: "Client",
    email: "client@secretlab.com",
    password: "supertest",
    testID: "test-account-client",
  },
  {
    label: "Manager",
    email: "manager@secretlab.com",
    password: "supertest",
    testID: "test-account-manager",
  },
  {
    label: "Super User",
    email: "jason@secretlab.com",
    password: "supertest",
    testID: "test-account-super-user",
  },
  {
    label: "Coordinator",
    email: "coordinator@secretlab.com",
    password: "supertest",
    testID: "test-account-coordinator",
  },
];
