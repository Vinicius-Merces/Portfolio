document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('clients-table');
    const uploadForm = document.getElementById('upload-form');
    const addRowBtn = document.getElementById('add-row');

    // Auto-save em cada edição de célula
    table.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD' && e.target.contentEditable) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            const cells = row.querySelectorAll('td[contenteditable]');
            const data = {
                name: cells[0].innerText,
                email: cells[1].innerText,
                phone: cells[2].innerText,
                city: cells[3].innerText,
                notes: cells[4].innerText
            };
            fetch(`/update_client/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => res.json()).then(data => console.log(data));
        }
    });

    // Excluir linha
    table.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete')) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            fetch(`/delete_client/${id}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    row.remove();
                    console.log(data);
                });
        }
    });

    // Adicionar linha
    addRowBtn.addEventListener('click', () => {
        fetch('/add_client', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                const tbody = table.querySelector('tbody');
                const row = document.createElement('tr');
                row.dataset.id = data.id;
                row.innerHTML = `
                    <td>${data.id}</td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td contenteditable="true"></td>
                    <td><button class="delete">Excluir</button></td>
                `;
                tbody.appendChild(row);
            });
    });

    // Upload de CSV
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        fetch('/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                alert(data.success || data.error);
                location.reload();  // Recarrega para mostrar novos dados
            });
    });
});