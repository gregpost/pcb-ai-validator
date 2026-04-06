import { execSync } from 'child_process';

function check(cmd: string) {
  try {
    const out = execSync(cmd, { stdio: 'pipe' }).toString();
    console.log(`[OK] ${cmd}: ${out.split('\n')[0]}`);
    return true;
  } catch (e: any) {
    console.log(`[FAIL] ${cmd}: ${e.message.split('\n')[0]}`);
    return false;
  }
}

console.log('--- Диагностика окружения ---');
check('python3 --version');
check('python3 -m pip --version');
check('pip3 --version');
check('pip --version');
check('python3 -m ensurepip --version');
check('python3 -m venv --help');
