function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fika-zweeds', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('progress')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function useDatabase(mode, operation) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('progress', mode)
      const request = operation(transaction.objectStore('progress'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export function loadProgress() {
  return useDatabase('readonly', store => store.get('current'))
}

export function saveProgress(progress) {
  return useDatabase('readwrite', store => store.put(progress, 'current'))
}

export function clearProgress() {
  return useDatabase('readwrite', store => store.clear())
}
