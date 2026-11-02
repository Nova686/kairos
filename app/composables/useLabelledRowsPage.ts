export const useLabelledRowsPage = (endpoint: string, fieldName: 'label' | 'name') => {
  const { rows, createRow, updateRow, deleteRow, pending, errorMessage } = useOwnedCollection<{
    id: string
    label?: string
    name?: string
  }>(endpoint)
  const newText = ref('')
  const editedRowId = ref('')
  const editedText = ref('')

  const labelledRows = computed(() => rows.value.map(row => ({ id: row.id, text: row[fieldName] ?? '' })))

  const addRow = async () => {
    if (newText.value.trim() === '') {
      return
    }
    if (await createRow({ [fieldName]: newText.value })) {
      newText.value = ''
    }
  }

  const startEditing = (rowId: string, currentText: string) => {
    editedRowId.value = rowId
    editedText.value = currentText
  }

  const cancelEditing = () => {
    editedRowId.value = ''
  }

  const saveEditing = async () => {
    if (await updateRow(editedRowId.value, { [fieldName]: editedText.value })) {
      editedRowId.value = ''
    }
  }

  return {
    labelledRows,
    newText,
    editedRowId,
    editedText,
    pending,
    errorMessage,
    addRow,
    startEditing,
    cancelEditing,
    saveEditing,
    deleteRow,
  }
}
