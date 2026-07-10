// ============================================================
// Painel de Configuração — o cliente monta o próprio site.
// Gera um arquivo dados.js (com fotos embutidas em base64) que
// o vendedor solta numa cópia do template e publica.
// ============================================================

const WHATSAPP = '5512974031951'; // contato para receber o arquivo
const CHAVE_RASCUNHO = 'via-rascunho-site';

// ---- Estado inicial (o "molde" que o cliente vai preencher) ----
function estadoPadrao() {
    return {
        capaTitulo: 'Para você',
        capaDica: 'toque para entrar',
        heroEyebrow: 'Para o meu amor',
        heroTitulo: 'Te amo',
        heroSubtitulo: 'Uma declaração especial para você',
        heroTexto: '',
        bilhetes: [
            { texto: '', rabisco: 'todos os dias', cor: 'algodao', tilt: -4 },
            { texto: '', rabisco: 'todas as horas', cor: 'menta', tilt: 3 },
            { texto: '', rabisco: 'para sempre', cor: 'manteiga', tilt: -2 },
            { texto: '', rabisco: 'eternidade', cor: 'algodao', tilt: 4 },
        ],
        fotos: [
            { arquivo: '', legenda: '', tamanho: 'grande' },
            { arquivo: '', legenda: '', tamanho: 'normal' },
            { arquivo: '', legenda: '', tamanho: 'normal' },
            { arquivo: '', legenda: '', tamanho: 'alta' },
            { arquivo: '', legenda: '', tamanho: 'normal' },
            { arquivo: '', legenda: '', tamanho: 'larga' },
            { arquivo: '', legenda: '', tamanho: 'normal' },
            { arquivo: '', legenda: '', tamanho: 'larga' }, // a última fica larga: sobra no fim do mural parece proposital
        ],
        motivos: [
            { titulo: 'Motivo 1', texto: '' },
            { titulo: 'Motivo 2', texto: '' },
            { titulo: 'Motivo 3', texto: '' },
            { titulo: 'Motivo 4', texto: '' },
        ],
        surpresas: ['', '', '', '', '', ''],
        musica: '',
        _tema: 'kawaii', // estilo escolhido (kawaii | noite | vintage | elegante)
        _plano: null, // padrao | completo | premium — vem do link da página de vendas (?plano=)
    };
}

const TEMAS_VALIDOS = ['kawaii', 'noite', 'vintage', 'elegante'];

// Limites de cada plano — precisam bater com os itens em Pagina de Vendas/config.js
const PLANOS = {
    padrao:   { nome: 'Padrão',   maxFotos: 8,    musica: false },
    completo: { nome: 'Completo', maxFotos: 12,   musica: true  },
    premium:  { nome: 'Premium',  maxFotos: null, musica: true  }, // null = ilimitado
};

function planoAtivo() {
    return PLANOS[estado._plano] || null;
}

// Se o link veio da página de vendas com ?plano=..., aplica (e prevalece sobre um rascunho antigo)
function aplicarPlanoDaURL() {
    const params = new URLSearchParams(location.search);
    const planoParam = params.get('plano');
    if (planoParam && PLANOS[planoParam]) {
        estado._plano = planoParam;
    }
}

let estado = carregarRascunho() || estadoPadrao();
aplicarPlanoDaURL();

// ------------------------------------------------------------
// Preview (iframe) — manda os dados a cada alteração (com debounce)
// ------------------------------------------------------------
const frame = document.getElementById('preview-frame');
let framePronto = false;

frame.addEventListener('load', () => {
    framePronto = true;
    enviarPreview();
});

let timerPreview = null;
function agendarPreview() {
    clearTimeout(timerPreview);
    timerPreview = setTimeout(enviarPreview, 250);
}
function enviarPreview() {
    if (!framePronto) return;
    frame.contentWindow.postMessage({ tipo: 'via-preview', dados: estado }, '*');
}

// Chamado sempre que algo muda: atualiza prévia + salva rascunho leve
function aoMudar() {
    agendarPreview();
    salvarRascunho(true); // silencioso
    atualizarContadores();
}

// ------------------------------------------------------------
// Campos simples (data-campo) — ligação direta ao estado
// ------------------------------------------------------------
document.querySelectorAll('[data-campo]').forEach(el => {
    el.value = estado[el.dataset.campo] || '';
    el.addEventListener('input', () => {
        estado[el.dataset.campo] = el.value;
        aoMudar();
    });
});

// ------------------------------------------------------------
// Bilhetes
// ------------------------------------------------------------
const CORES = [
    { id: 'algodao', hex: '#ffd3e2' },
    { id: 'menta', hex: '#cdeede' },
    { id: 'manteiga', hex: '#fff1c2' },
];

function montarBilhetes() {
    const cont = document.getElementById('campos-bilhetes');
    cont.innerHTML = '';
    estado.bilhetes.forEach((b, i) => {
        const bloco = document.createElement('div');
        bloco.className = 'bloco';
        bloco.innerHTML = `
            <span class="bloco-titulo">Bilhete ${i + 1}</span>
            <label>Mensagem
                <textarea rows="2" placeholder="Algo que você diria todos os dias...">${escaparAttr(b.texto)}</textarea>
            </label>
            <label>Selinho (frase curtinha)
                <input type="text" maxlength="24" value="${escaparAttr(b.rabisco)}" placeholder="para sempre">
            </label>
            <div class="bloco-cores" title="Cor do post-it"></div>
        `;
        const [txt, rab] = bloco.querySelectorAll('textarea, input');
        txt.addEventListener('input', () => { b.texto = txt.value; aoMudar(); });
        rab.addEventListener('input', () => { b.rabisco = rab.value; aoMudar(); });

        const cores = bloco.querySelector('.bloco-cores');
        CORES.forEach(c => {
            const bola = document.createElement('button');
            bola.type = 'button';
            bola.className = 'bola-cor' + (b.cor === c.id ? ' sel' : '');
            bola.style.background = c.hex;
            bola.addEventListener('click', () => {
                b.cor = c.id;
                cores.querySelectorAll('.bola-cor').forEach(x => x.classList.remove('sel'));
                bola.classList.add('sel');
                aoMudar();
            });
            cores.appendChild(bola);
        });
        cont.appendChild(bloco);
    });
}

// ------------------------------------------------------------
// Fotos (upload + compressão + base64)
// ------------------------------------------------------------
// Tamanhos que o mural aceita (mesmos ids do script.js dos temas)
const TAMANHOS_FOTO = [
    { id: 'normal', rotulo: 'quadrada' },
    { id: 'grande', rotulo: 'destaque (2×2)' },
    { id: 'larga',  rotulo: 'horizontal (2×1)' },
    { id: 'alta',   rotulo: 'vertical (1×2)' },
];

function montarFotos() {
    const cont = document.getElementById('campos-fotos');
    cont.innerHTML = '';
    const plano = planoAtivo();
    const maxFotos = plano ? plano.maxFotos : null; // null = sem limite conhecido (link sem ?plano=, uso interno/teste)
    const podeGerenciarSlots = !!plano; // só permite adicionar/excluir slot quando o plano é conhecido

    estado.fotos.forEach((f, i) => {
        const slot = document.createElement('div');
        slot.className = 'slot-foto';
        slot.innerHTML = `
            ${podeGerenciarSlots && estado.fotos.length > 1 ? `<button type="button" class="btn-excluir-slot" title="Remover este slot">✕</button>` : ''}
            <label class="foto-preview">
                ${f.arquivo ? `<img src="${f.arquivo}" alt="">` : `<span>📷 Foto ${i + 1}<br>toque para escolher</span>`}
                <input type="file" accept="image/*">
            </label>
            <input type="text" placeholder="Legenda (opcional)" value="${escaparAttr(f.legenda)}">
            <select class="sel-tamanho" title="Tamanho da foto no mural">
                ${TAMANHOS_FOTO.map(t => `<option value="${t.id}"${f.tamanho === t.id ? ' selected' : ''}>${t.rotulo}</option>`).join('')}
            </select>
            ${f.arquivo ? `<button type="button" class="btn-remover">remover foto</button>` : ''}
        `;
        const input = slot.querySelector('input[type="file"]');
        const legenda = slot.querySelector('input[type="text"]');
        const tamanho = slot.querySelector('.sel-tamanho');
        const remover = slot.querySelector('.btn-remover');
        const excluirSlot = slot.querySelector('.btn-excluir-slot');

        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            const preview = slot.querySelector('.foto-preview');
            preview.innerHTML = '<span>comprimindo…</span><input type="file" accept="image/*">';
            try {
                f.arquivo = await comprimirImagem(file);
            } catch {
                alert('Não consegui ler essa imagem. Tente outra foto.');
            }
            montarFotos();
            aoMudar();
        });
        legenda.addEventListener('input', () => { f.legenda = legenda.value; aoMudar(); });
        tamanho.addEventListener('change', () => { f.tamanho = tamanho.value; aoMudar(); });
        if (remover) {
            remover.addEventListener('click', () => {
                f.arquivo = '';
                montarFotos();
                aoMudar();
            });
        }
        if (excluirSlot) {
            excluirSlot.addEventListener('click', () => {
                estado.fotos.splice(i, 1);
                montarFotos();
                aoMudar();
            });
        }
        cont.appendChild(slot);
    });

    // Botão de adicionar slot — só aparece se o plano permitir mais fotos
    const btnAdd = document.getElementById('add-foto');
    btnAdd.hidden = !(podeGerenciarSlots && (maxFotos === null || estado.fotos.length < maxFotos));

    // Texto de ajuda reflete o limite do plano
    const dica = document.getElementById('dica-fotos');
    if (plano) {
        dica.textContent = maxFotos
            ? `Seu plano permite até ${maxFotos} fotos. As fotos ficam guardadas dentro do próprio site.`
            : 'Seu plano permite fotos ilimitadas. As fotos ficam guardadas dentro do próprio site.';
    } else {
        dica.textContent = 'Suba até 8 fotos do casal. As fotos ficam guardadas dentro do próprio site (não precisa mandar separado). Pode deixar slots em branco.';
    }
}

document.getElementById('add-foto').addEventListener('click', () => {
    estado.fotos.push({ arquivo: '', legenda: '', tamanho: 'normal' });
    montarFotos();
    aoMudar();
});

function comprimirImagem(file, maxLado = 1200, qualidade = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxLado) {
                    height = Math.round(height * maxLado / width);
                    width = maxLado;
                } else if (height >= width && height > maxLado) {
                    width = Math.round(width * maxLado / height);
                    height = maxLado;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', qualidade));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ------------------------------------------------------------
// Motivos (com adicionar/remover)
// ------------------------------------------------------------
function montarMotivos() {
    const cont = document.getElementById('campos-motivos');
    cont.innerHTML = '';
    estado.motivos.forEach((m, i) => {
        const bloco = document.createElement('div');
        bloco.className = 'bloco';
        bloco.innerHTML = `
            <span class="bloco-titulo">Motivo ${i + 1}</span>
            <label>Título curto
                <input type="text" maxlength="30" value="${escaparAttr(m.titulo)}" placeholder="Seu sorriso">
            </label>
            <label>Texto
                <textarea rows="2" placeholder="Por que você ama isso...">${escaparAttr(m.texto)}</textarea>
            </label>
            ${estado.motivos.length > 1 ? `<button type="button" class="btn-remover">remover motivo</button>` : ''}
        `;
        const titulo = bloco.querySelector('input');
        const texto = bloco.querySelector('textarea');
        const remover = bloco.querySelector('.btn-remover');
        titulo.addEventListener('input', () => { m.titulo = titulo.value; aoMudar(); });
        texto.addEventListener('input', () => { m.texto = texto.value; aoMudar(); });
        if (remover) {
            remover.addEventListener('click', () => {
                estado.motivos.splice(i, 1);
                montarMotivos();
                aoMudar();
            });
        }
        cont.appendChild(bloco);
    });
}

document.getElementById('add-motivo').addEventListener('click', () => {
    estado.motivos.push({ titulo: `Motivo ${estado.motivos.length + 1}`, texto: '' });
    montarMotivos();
    aoMudar();
});

// ------------------------------------------------------------
// Surpresas (raspadinhas) — 6 campos fixos
// ------------------------------------------------------------
function montarSurpresas() {
    const cont = document.getElementById('campos-surpresas');
    cont.innerHTML = '';
    estado.surpresas.forEach((s, i) => {
        const label = document.createElement('label');
        label.innerHTML = `Surpresa ${i + 1}
            <input type="text" maxlength="60" value="${escaparAttr(s)}" placeholder="Te amo! / Um beijo / Você é incrível">`;
        const input = label.querySelector('input');
        input.addEventListener('input', () => { estado.surpresas[i] = input.value; aoMudar(); });
        cont.appendChild(label);
    });
}

// ------------------------------------------------------------
// Música
// ------------------------------------------------------------
const inputMusica = document.getElementById('input-musica');
const nomeMusica = document.getElementById('nome-musica');
const removerMusica = document.getElementById('remover-musica');
const avisoMusica = document.getElementById('aviso-musica');

inputMusica.addEventListener('change', () => {
    const file = inputMusica.files[0];
    if (!file) return;
    const mb = file.size / (1024 * 1024);
    const reader = new FileReader();
    reader.onload = () => {
        estado.musica = reader.result; // data: URI
        nomeMusica.textContent = file.name;
        removerMusica.hidden = false;
        if (mb > 4) {
            avisoMusica.hidden = false;
            avisoMusica.textContent = `⚠️ Esse MP3 tem ${mb.toFixed(1)} MB. Funciona, mas deixa o site mais pesado. O ideal é menos de 4 MB.`;
        } else {
            avisoMusica.hidden = true;
        }
        aoMudar();
    };
    reader.readAsDataURL(file);
});
removerMusica.addEventListener('click', () => {
    estado.musica = '';
    inputMusica.value = '';
    nomeMusica.textContent = 'Escolher arquivo .mp3';
    removerMusica.hidden = true;
    avisoMusica.hidden = true;
    aoMudar();
});

// Bloqueia a seção inteira se o plano não incluir música (ex: Padrão)
function atualizarGatingMusica() {
    const plano = planoAtivo();
    const bloqueada = !!plano && !plano.musica;
    document.getElementById('musica-bloqueada').hidden = !bloqueada;
    document.getElementById('musica-conteudo').style.display = bloqueada ? 'none' : '';
    document.getElementById('musica-badge').textContent = bloqueada ? 'bloqueado' : 'opcional';
    if (bloqueada && estado.musica) {
        estado.musica = ''; // segurança: rascunho antigo de outro plano não deve carregar música
    }
}

// ------------------------------------------------------------
// Contadores nos títulos das seções
// ------------------------------------------------------------
function atualizarContadores() {
    const preenchidos = (arr, fn) => arr.filter(fn).length;
    document.getElementById('conta-bilhetes').textContent =
        `${preenchidos(estado.bilhetes, b => b.texto.trim())}/${estado.bilhetes.length}`;

    const plano = planoAtivo();
    const maxFotos = plano ? plano.maxFotos : null;
    const fotosPreenchidas = preenchidos(estado.fotos, f => f.arquivo);
    document.getElementById('conta-fotos').textContent = maxFotos
        ? `${fotosPreenchidas}/${maxFotos}`
        : plano ? `${fotosPreenchidas} (ilimitado)` : `${fotosPreenchidas}/${estado.fotos.length}`;

    document.getElementById('conta-motivos').textContent =
        `${preenchidos(estado.motivos, m => m.texto.trim())}/${estado.motivos.length}`;
    document.getElementById('conta-surpresas').textContent =
        `${preenchidos(estado.surpresas, s => s.trim())}/${estado.surpresas.length}`;
}

// ------------------------------------------------------------
// Rascunho (localStorage). Fotos podem estourar a cota — tratamos.
// ------------------------------------------------------------
const notaRascunho = document.getElementById('nota-rascunho');

function salvarRascunho(silencioso) {
    try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(estado));
        if (!silencioso) mostrarNota('Rascunho salvo! Pode fechar e voltar depois. 💾');
    } catch {
        // Cota estourada (fotos grandes): salva sem as fotos
        try {
            const leve = JSON.parse(JSON.stringify(estado));
            leve.fotos = leve.fotos.map(f => ({ ...f, arquivo: '' }));
            leve.musica = '';
            localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(leve));
            if (!silencioso) mostrarNota('Rascunho salvo (textos). As fotos são grandes demais pra guardar — só ficam no site final.');
        } catch {
            if (!silencioso) mostrarNota('Não deu pra salvar o rascunho neste navegador.');
        }
    }
}

function carregarRascunho() {
    try {
        const bruto = localStorage.getItem(CHAVE_RASCUNHO);
        if (!bruto) return null;
        const base = estadoPadrao();
        return Object.assign(base, JSON.parse(bruto));
    } catch {
        return null;
    }
}

let timerNota = null;
function mostrarNota(txt) {
    notaRascunho.textContent = txt;
    clearTimeout(timerNota);
    timerNota = setTimeout(() => { notaRascunho.textContent = ''; }, 4000);
}

document.getElementById('btn-rascunho').addEventListener('click', () => salvarRascunho(false));

document.getElementById('btn-limpar').addEventListener('click', () => {
    if (!confirm('Isso apaga tudo que você preencheu e volta ao começo. Tem certeza?')) return;
    localStorage.removeItem(CHAVE_RASCUNHO);
    estado = estadoPadrao();
    aplicarPlanoDaURL();
    recarregarFormularioInteiro();
    atualizarBannerPlano();
    atualizarGatingMusica();
    trocarTema(estado._tema); // volta a prévia e o botão destacado pro tema padrão
    aoMudar();
});

// ------------------------------------------------------------
// Banner do plano ativo
// ------------------------------------------------------------
function atualizarBannerPlano() {
    const banner = document.getElementById('plano-info');
    const plano = planoAtivo();
    if (!plano) { banner.hidden = true; return; }
    const fotosTxt = plano.maxFotos ? `até ${plano.maxFotos} fotos` : 'fotos ilimitadas';
    const musicaTxt = plano.musica ? 'com música de fundo' : 'sem música de fundo';
    banner.hidden = false;
    banner.innerHTML = `💳 Plano <strong>${plano.nome}</strong> — ${fotosTxt}, ${musicaTxt}`;
}

// ------------------------------------------------------------
// Gerar o arquivo dados.js
// ------------------------------------------------------------
document.getElementById('btn-gerar').addEventListener('click', gerarArquivo);

function gerarArquivo() {
    const conteudo =
        '// Arquivo gerado pelo Painel de Configuração — envie este arquivo para publicação.\n' +
        'const DADOS = ' + JSON.stringify(estado, null, 2) + ';\n';
    const blob = new Blob([conteudo], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dados.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    abrirModalPronto();
}

// ------------------------------------------------------------
// Modal "pronto" + WhatsApp
// ------------------------------------------------------------
const modal = document.getElementById('modal-pronto');
function abrirModalPronto() {
    const msg = encodeURIComponent('Oi! Terminei de montar meu site 💕 Vou te mandar o arquivo dados.js aqui.');
    document.getElementById('btn-whats').href = `https://wa.me/${WHATSAPP}?text=${msg}`;
    modal.hidden = false;
}
document.getElementById('modal-fechar').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

// ------------------------------------------------------------
// Abas (mobile)
// ------------------------------------------------------------
document.querySelectorAll('.aba').forEach(aba => {
    aba.addEventListener('click', () => {
        document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
        aba.classList.add('ativa');
        document.body.classList.remove('mostrar-editar', 'mostrar-previa');
        document.body.classList.add(aba.dataset.aba === 'previa' ? 'mostrar-previa' : 'mostrar-editar');
        if (aba.dataset.aba === 'previa') enviarPreview();
    });
});
document.body.classList.add('mostrar-editar');

document.getElementById('recarregar').addEventListener('click', () => {
    framePronto = false;
    frame.src = frame.src; // recarrega o iframe
});

// ------------------------------------------------------------
// Seletor de tema
// ------------------------------------------------------------
let temaNaPrevia = 'kawaii'; // tema carregado no iframe agora (bate com o src inicial no HTML)

function trocarTema(tema, forcarReload) {
    if (!TEMAS_VALIDOS.includes(tema)) tema = 'kawaii';
    const mudou = estado._tema !== tema;
    estado._tema = tema;

    // destaca o botão selecionado
    document.querySelectorAll('.tema-opcao').forEach(b => {
        b.classList.toggle('sel', b.dataset.tema === tema);
    });

    // recarrega a prévia se o iframe ainda não está neste tema
    // (compara com o iframe, não com o estado — senão um rascunho salvo
    // em outro tema abre destacando o tema certo mas mostrando o kawaii)
    if (temaNaPrevia !== tema || forcarReload) {
        temaNaPrevia = tema;
        framePronto = false;
        frame.src = `preview/${tema}/index.html`;
    }
    if (mudou) { salvarRascunho(true); }
}

document.querySelectorAll('.tema-opcao').forEach(btn => {
    btn.addEventListener('click', () => trocarTema(btn.dataset.tema));
});

// ------------------------------------------------------------
// Utilidades + boot
// ------------------------------------------------------------
function escaparAttr(txt) {
    return (txt == null ? '' : String(txt))
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function recarregarFormularioInteiro() {
    document.querySelectorAll('[data-campo]').forEach(el => {
        el.value = estado[el.dataset.campo] || '';
    });
    // reset música UI
    if (estado.musica) {
        nomeMusica.textContent = 'música carregada';
        removerMusica.hidden = false;
    } else {
        nomeMusica.textContent = 'Escolher arquivo .mp3';
        removerMusica.hidden = true;
    }
    avisoMusica.hidden = true;
    montarBilhetes();
    montarFotos();
    montarMotivos();
    montarSurpresas();
}

montarBilhetes();
montarFotos();
montarMotivos();
montarSurpresas();
atualizarContadores();
atualizarBannerPlano();
atualizarGatingMusica();
if (estado.musica) { nomeMusica.textContent = 'música carregada'; removerMusica.hidden = false; }

// Aplica o tema salvo (destaca o botão e, se não for o kawaii padrão, recarrega a prévia)
trocarTema(estado._tema || 'kawaii', false);
