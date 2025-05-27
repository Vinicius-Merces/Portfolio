// Configuração do Firebase (ATENÇÃO: Mova para um local seguro e configure corretamente!)
const firebaseConfig = {
    apiKey: "AIzaSyAmrAtNIsd7Bp-tRAmavI-wwlLgd4_zkEc", // Chave de exemplo - SUBSTITUA PELA SUA!
    authDomain: "julianabeauty.firebaseapp.com",
    projectId: "julianabeauty",
    storageBucket: "julianabeauty.firebasestorage.app",
    messagingSenderId: "881281165323",
    appId: "1:881281165323:web:4c8e5a1e7ca37272a27f0e",
    measurementId: "G-GD2V0K5TF4" // Opcional
};

// Inicializar Firebase (versão compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Inicializar Firestore

// Controle de Agendamentos
class AgendamentoManager {
    constructor() {
        this.form = document.getElementById("agendamentoForm");
        this.loadingSpinner = document.getElementById("loadingSpinner");
        this.statusMessageDiv = document.getElementById("statusMessage");
        this.dataInput = document.getElementById("dataHora");
        this.initEventListeners();
        this.configurarDataMinima();
    }

    initEventListeners() {
        if (this.form) {
            this.form.addEventListener("submit", async (e) => await this.handleSubmit(e));
        }
    }

    configurarDataMinima() {
        if (this.dataInput) {
            const now = new Date();
            // Ajuste para o fuso horário local (exemplo: UTC-3)
            // O ideal é fazer isso no backend ou usar bibliotecas como moment-timezone
            // Para simplificar, vamos apenas garantir que a data/hora local seja usada
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            this.dataInput.min = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const btn = this.form.querySelector("button[type=\"submit\"]");
        btn.disabled = true;
        this.loadingSpinner.style.display = "inline-block";
        this.clearMessage();

        try {
            const agendamento = {
                nome: document.getElementById("nomeCompleto").value.trim(),
                whatsapp: document.getElementById("whatsapp").value.trim(),
                servico: document.getElementById("servico").value,
                dataHoraISO: document.getElementById("dataHora").value, // Manter ISO para Firestore
                observacoes: document.getElementById("observacoes").value.trim(),
                status: "pendente",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validar dados
            this.validarAgendamento(agendamento);

            // Salvar no Firestore
            const docRef = await db.collection("agendamentos").add(agendamento);

            // Enviar para WhatsApp (após sucesso no DB)
            await this.enviarWhatsApp(agendamento, docRef.id);

            // Feedback ao usuário
            this.showMessage("Agendamento confirmado com sucesso! Verifique seu WhatsApp para detalhes.", "success");
            this.form.reset();
            this.configurarDataMinima(); // Resetar data mínima após reset do form

        } catch (error) {
            console.error("Erro no agendamento:", error);
            this.showMessage(`Erro ao agendar: ${error.message}`, "danger");
        } finally {
            btn.disabled = false;
            this.loadingSpinner.style.display = "none";
        }
    }

    validarAgendamento(agendamento) {
        if (!agendamento.nome || !agendamento.whatsapp || !agendamento.servico || !agendamento.dataHoraISO) {
            throw new Error("Por favor, preencha todos os campos obrigatórios.");
        }

        const dataAgendamento = new Date(agendamento.dataHoraISO);
        const agora = new Date();
        const horaMinima = new Date(agora.getTime() + 2 * 60 * 60 * 1000); // Adiciona 2 horas

        if (isNaN(dataAgendamento.getTime())) {
             throw new Error("Data ou hora inválida.");
        }

        if (dataAgendamento < horaMinima) {
            throw new Error("O agendamento deve ser feito com pelo menos 2 horas de antecedência.");
        }

        if (!/^\d{11}$/.test(agendamento.whatsapp)) {
            throw new Error("Número de WhatsApp inválido. Use 11 dígitos (DDD + número).");
        }
    }

    async enviarWhatsApp(agendamento, id) {
        const dataAgendamento = new Date(agendamento.dataHoraISO);
        const dataFormatada = dataAgendamento.toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' });

        const mensagem = `✅ *Agendamento Confirmado* ✅\n\n`
            + `*Nome:* ${agendamento.nome}\n`
            + `*Serviço:* ${agendamento.servico}\n`
            + `*Data/Hora:* ${dataFormatada}\n\n`
            + `_Aguardamos você! Qualquer alteração, por favor, entre em contato._`;

        const linkWhatsApp = `https://wa.me/55?text=${encodeURIComponent(mensagem)}`;
        // Abrir em nova aba de forma assíncrona para não bloquear
        setTimeout(() => window.open(linkWhatsApp, "_blank"), 0);
    }

    showMessage(message, type) {
        this.statusMessageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                ${message}
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                            </div>`;
    }

    clearMessage() {
        this.statusMessageDiv.innerHTML = "";
    }
}

// Inicializar o sistema de agendamento quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const agendamentoManager = new AgendamentoManager();
});
