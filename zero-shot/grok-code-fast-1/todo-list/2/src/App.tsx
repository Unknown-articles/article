import { TodoProvider } from './TodoContext';
import TodoApp from './components/TodoApp';

function App() {
  return (
    <TodoProvider>
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-center mb-8">To-Do List</h1>
          <TodoApp />
        </div>
      </div>
    </TodoProvider>
  );
}

export default App;