import { Flexbox } from '@lobehub/ui';
import { actionMap, type ActionKey } from './config';

interface ActionBarProps {
  actions: ActionKey[];
}

export function ActionBar({ actions }: ActionBarProps) {
  return (
    <Flexbox horizontal align="center" gap={2}>
      {actions.map((key) => {
        const Render = actionMap[key];
        return <Render key={key} />;
      })}
    </Flexbox>
  );
}
