import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JenkinsBuildResult,
  TestcaseScanStatus,
  type TestcaseScanDto,
} from '@todo-platform/shared-types';
import {
  formatJenkinsBuildResult,
  formatTestcaseScanResultLabel,
  getActiveTestcaseScans,
  testcaseScanResultBadgeClassName,
  testcaseScanStatusChipClassName,
} from './testcaseScanDisplay';

function scan(partial: Partial<TestcaseScanDto> & Pick<TestcaseScanDto, 'status'>): TestcaseScanDto {
  return {
    id: 'scan-1',
    todoId: 'todo-1',
    name: 'Regression',
    buildResult: null,
    jobUrl: null,
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    ...partial,
  };
}

describe('testcaseScanDisplay', () => {
  it('maps Jenkins build results to stable/unstable labels', () => {
    assert.equal(formatJenkinsBuildResult(JenkinsBuildResult.SUCCESS), 'Stable');
    assert.equal(formatJenkinsBuildResult(JenkinsBuildResult.UNSTABLE), 'Unstable');
    assert.equal(formatJenkinsBuildResult(JenkinsBuildResult.FAILURE), 'Failed');
    assert.equal(formatJenkinsBuildResult(JenkinsBuildResult.ABORTED), 'Aborted');
  });

  it('prefers buildResult over workflow status for popup labels', () => {
    assert.equal(
      formatTestcaseScanResultLabel(
        scan({
          status: TestcaseScanStatus.COMPLETED,
          buildResult: JenkinsBuildResult.UNSTABLE,
        }),
      ),
      'Unstable',
    );
    assert.equal(
      formatTestcaseScanResultLabel(
        scan({ status: TestcaseScanStatus.SCANNING, buildResult: null }),
      ),
      'Scanning',
    );
  });

  it('returns only scanning records for active card chips', () => {
    const scans = [
      scan({ id: 'a', status: TestcaseScanStatus.COMPLETED }),
      scan({ id: 'b', status: TestcaseScanStatus.SCANNING }),
      scan({ id: 'c', status: TestcaseScanStatus.FAILED }),
    ];

    assert.deepEqual(getActiveTestcaseScans(scans).map((s) => s.id), ['b']);
    assert.deepEqual(getActiveTestcaseScans(undefined), []);
  });

  it('maps scan status chip classes', () => {
    assert.equal(
      testcaseScanStatusChipClassName(TestcaseScanStatus.SCANNING),
      'testcase-scan-chip-scanning',
    );
  });

  it('maps build result badge classes', () => {
    assert.equal(
      testcaseScanResultBadgeClassName(
        scan({
          status: TestcaseScanStatus.COMPLETED,
          buildResult: JenkinsBuildResult.UNSTABLE,
        }),
      ),
      'badge-yellow',
    );
    assert.equal(
      testcaseScanResultBadgeClassName(
        scan({
          status: TestcaseScanStatus.COMPLETED,
          buildResult: JenkinsBuildResult.SUCCESS,
        }),
      ),
      'badge-green',
    );
  });
});
