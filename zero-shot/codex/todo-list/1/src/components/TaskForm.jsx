import { useEffect, useState } from 'react';

const emptyForm = {
  title: '',
  date: '',
};

export function TaskForm({ editingTask, onCancel, onSubmit }) {
  const [formValues, setFormValues] = useState(emptyForm);

  useEffect(() => {
    if (!editingTask) {
      setFormValues(emptyForm);
      return;
    }

    setFormValues({
      title: editingTask.title,
      date: editingTask.date,
    });
  }, [editingTask]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formValues.title.trim() || !formValues.date) {
      return;
    }

    onSubmit(formValues);

    if (!editingTask) {
      setFormValues(emptyForm);
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Task title</span>
        <input
          name="title"
          onChange={handleChange}
          placeholder="Ship the interaction polish"
          type="text"
          value={formValues.title}
        />
      </label>
      <label className="field">
        <span className="field-label">Due date</span>
        <input
          name="date"
          onChange={handleChange}
          type="date"
          value={formValues.date}
        />
      </label>
      <div className="task-form-actions">
        <button className="primary-button" type="submit">
          {editingTask ? 'Save task' : 'Add task'}
        </button>
        {editingTask ? (
          <button className="ghost-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
