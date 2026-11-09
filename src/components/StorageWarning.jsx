export default function StorageWarning({ message }) {
  return message ? <p role="alert" className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-4 mb-4">{message}</p> : null
}
