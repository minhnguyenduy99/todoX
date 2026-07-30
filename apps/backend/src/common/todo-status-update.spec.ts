import { TodoStatus } from '@todo-platform/shared-types';
import { todoStatusUpdateData } from './todo-status-update';

describe('todoStatusUpdateData', () => {
  it('returns status and statusUpdateDate', () => {
    const at = new Date('2026-07-30T12:00:00.000Z');
    expect(todoStatusUpdateData(TodoStatus.TESTING, at)).toEqual({
      status: TodoStatus.TESTING,
      statusUpdateDate: at,
    });
  });
});
