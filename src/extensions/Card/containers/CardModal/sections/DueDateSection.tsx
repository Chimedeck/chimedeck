// DueDateSection — displays and allows editing the card due date (with time and done state).
import CardDueDate from '../../../components/CardDueDate';

interface Props {
  dueDate: string | null;
  dueComplete: boolean;
  onChange: (dueDate: string | null) => void;
  onDoneChange: (done: boolean) => void;
  disabled?: boolean;
}

export const DueDateSection = ({ dueDate, dueComplete, onChange, onDoneChange, disabled }: Props) => (
  <section aria-label="Due date">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">Due date</h3>
    <CardDueDate
      dueDate={dueDate}
      dueComplete={dueComplete}
      onChange={onChange}
      onDoneChange={onDoneChange}
      disabled={disabled}
    />
  </section>
);
