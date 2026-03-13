import { workerData, parentPort } from 'worker_threads';
import { BloomFilter } from 'bloom-filters';
import { UserIdentifiers } from '@/repositories';

export interface WorkerInput {
  identifiers: UserIdentifiers[];
  falsePositiveRate: number;
}

export interface WorkerResult {
  nicknameFilter: JSON;
  emailFilter: JSON;
}

const { identifiers, falsePositiveRate } = workerData as WorkerInput;

const withEmail = identifiers.filter((u) => u.email !== null);

const nicknameCount = Math.max(identifiers.length * 2, 1000);
const emailCount = Math.max(withEmail.length * 2, 1000);

const nicknameFilter = BloomFilter.create(nicknameCount, falsePositiveRate);
const emailFilter = BloomFilter.create(emailCount, falsePositiveRate);

identifiers.forEach(({ nickname, email }) => {
  nicknameFilter.add(nickname);
  if (email !== null) emailFilter.add(email);
});

parentPort!.postMessage({
  nicknameFilter: nicknameFilter.saveAsJSON() as JSON,
  emailFilter: emailFilter.saveAsJSON() as JSON,
});
