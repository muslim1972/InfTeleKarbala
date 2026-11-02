import fs from 'fs';
import path from 'path';

// Let's inspect the distinct first names of unspecified records
import { execSync } from 'child_process';
const dump = fs.readFileSync('D:/InfTeleKarbala/_archive/sql/profiles_dump.txt', 'utf8').split('\n').filter(Boolean);

// Let's create an enhanced word list
// We normalize Alef (أ, إ, آ -> ا)
