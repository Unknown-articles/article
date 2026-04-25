import { Action } from '../types';
import { format } from 'date-fns';

interface Props {
  actions: Action[];
}

export function ActionLog({ actions }: Props) {
  return (
    <div className="action-log">
      <h3>Action Log</h3>
      <ul>
        {actions.slice(-10).reverse().map((action, index) => (
          <li key={index}>
            {format(action.timestamp, 'HH:mm:ss')} - {action.type}
            {action.payload && <span> ({JSON.stringify(action.payload)})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}