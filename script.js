const PASS = 'Diciembre2025';
const USUARIOS_PERMITIDOS = [ "alba", "ana", "sergio", "invitado"];

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGQhwjv79kDf8_rZAKKRw24bbC3j_MgTU5nexwB9R8LJlD4KbiG4LzU1bm21sRd8EUtA/exec"; // URL del Apps Script
const MAX_ATTEMPTS = 2; // número máximo de intentos antes de no volver a reponer la pregunta
let questions=[], queue=[], current, score=0;
let subjectSelected='';
let preguntaActual = null;
let usuarioActual = null;

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ===================================== BOTONES Y ACIERTOS CENTRALIZADO ============================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

// Manejo centralizado de respuestas incorrectas: limita reintentos y muestra solución si se agota el límite.
function handleIncorrect() {
  // Aumentar contador local en el objeto pregunta
  if(typeof current.attempts === 'undefined') current.attempts = 0;
  current.attempts++;
  console.log("Intentos pregunta", current.id, current.attempts);

  // Si no supera el máximo, la reponemos al final de la cola
  if(current.attempts < MAX_ATTEMPTS){
    queue.push(current);
  } else {
    // Mostrar solución si es la última oportunidad
    try {
      document.getElementById("solucion").innerText = "Solución: " + (current.respuesta || '');
      document.getElementById("solucion").style.display = "block";
    } catch(e) { /* ignore if no UI */ }
  }
}

// Deshabilitar todos los controles de respuesta (opciones, botón comprobar, input)
function disableAnswerControls(){
  // botones dentro de #answers (opciones, playListeningBtn, etc.)
  document.querySelectorAll('#answers button, #answers [role="option"], #answers div[role="listitem"]').forEach(el=>{
    try{ el.disabled = true; }catch(e){}
    el.setAttribute && el.setAttribute('aria-disabled','true');
    el.classList && el.classList.add('disabled');
  });

  // botón de comprobar y campo de escritura
  const check = document.getElementById('checkBtn');
  if(check) { check.disabled = true; check.setAttribute('aria-disabled','true'); check.classList.add('disabled'); }
  const write = document.getElementById('writeAnswer');
  if(write) { write.disabled = true; write.setAttribute('aria-disabled','true'); write.classList.add('disabled'); }
}

// Re-habilitar controles al pasar a la siguiente pregunta
function enableAnswerControls(){
  document.querySelectorAll('#answers button, #answers [role="option"], #answers div[role="listitem"]').forEach(el=>{
    try{ el.disabled = false; }catch(e){}
    el.setAttribute && el.setAttribute('aria-disabled','false');
    el.classList && el.classList.remove('disabled');
  });

  const check = document.getElementById('checkBtn');
  if(check) { check.disabled = false; check.setAttribute('aria-disabled','false'); check.classList.remove('disabled'); }
  const write = document.getElementById('writeAnswer');
  if(write) { write.disabled = false; write.setAttribute('aria-disabled','false'); write.classList.remove('disabled'); }
}

// RESULT HANDLERS UNIFICADOS

function getEventTarget() {
  return window.event?.currentTarget instanceof HTMLElement
    ? window.event.currentTarget
    : null;
}

function handleCorrect(targetBtn = null, showNext = true) {
  const f = document.getElementById('feedback');
  f.innerText = '🌟 ¡Muy bien!';

  registrarEvento("Acierto");
  visualAcierto(targetBtn);

  disableAnswerControls();

  score++;
  animarPuntos();
  document.getElementById('score').innerText = score;

  if (showNext) {
    document.getElementById('next').style.display = 'block';
  }
}

function handleError(targetBtn = null, showSolution = true) {
  const f = document.getElementById('feedback');
  f.innerText = '💪 Inténtalo otra vez';

  registrarEvento("Error");
  visualError(targetBtn);

  if (showSolution && preguntaActual?.respuesta) {
    const s = document.getElementById("solucion");
    s.innerText = "Solución: " + preguntaActual.respuesta;
    s.style.display = "block";
  }

  handleIncorrect();
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================= INICIO DEL JUEGO ================================================= */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function login(){
  const nameInput = document.getElementById('name').value;
  const name = normalizarNombre(nameInput);

  usuarioActual = name;
  subjectSelected = "Lengua"; // o lo que ya tengas

  if(!name){
    alert('Introduce tu nombre');
    return;
  }

  // 🔒 COMPROBAR USUARIO PERMITIDO
  if(!USUARIOS_PERMITIDOS.includes(name)){
    alert('⛔ Usuario no autorizado');
    return;
  }

  // 🔐 COMPROBAR CONTRASEÑA
  if(document.getElementById('pass').value === PASS){
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    startGame();
  } else {
    alert('Contraseña incorrecta');
  }
}

async function startGame(){
  const r = await fetch('questions.csv');
  const t = await r.text();
  subjectSelected = document.getElementById('subject').value;

  questions = t.trim().split('\n').slice(1).map(l=>{
    const [id,asignatura,tipo,pregunta,opciones,respuesta,extra] = l.split(';');
    return {id,asignatura,tipo,pregunta,opciones,respuesta,extra, attempts:0};
  });

  // 🔹 FILTRAR POR ASIGNATURA
  queue = questions.filter(q=>q.asignatura===subjectSelected);

  // 🔹 ORDEN ALEATORIO
  shuffle(queue);

  nextQ();
}

function nextQ(){
  const q=document.getElementById('question');
  const a=document.getElementById('answers');
  const f=document.getElementById('feedback');
  const n=document.getElementById('next');
  const w=document.getElementById('writeAnswer');
  const c=document.getElementById('checkBtn');
  const s=document.getElementById('solucion');

  // 🔹 LIMPIAR SOLUCIÓN ANTERIOR
  s.innerText = '';
  s.style.display = 'none';

  a.innerHTML='';
  f.innerText='';
  n.style.display='none';
  w.style.display='none';
  c.style.display='none';
  
  // Habilitar controles al cargar nueva pregunta
  enableAnswerControls();

  if(!queue.length){
    q.innerText='🎉 ¡Asignatura terminada!';
    return;
  }

  current = queue.shift();
  // Variable global para observabilidad
  preguntaActual = current;

  // ajustar tamaño del área de respuestas según el tipo
  const answersEl = document.getElementById('answers');
  answersEl.classList.remove('large');
  if(current.tipo === 'ordenar' || current.tipo === 'arrastrar') {
    answersEl.classList.add('large');
  }

  if(current.extra){
    f.innerText='💡 Pista: '+current.extra;
  }

  // Escribimos el texto de la pregunta, siempre excepto que la pregunta sea una de estas:
  if(current.tipo != 'guess' || current.tipo != 'pronunciar' || current.tipo != 'hablar'){
    // Escribimos el texto de la pregunta
    q.innerText="";
    q.innerText=current.pregunta;
  }

  if(current.tipo==='escribir'){
    w.value='';
    w.style.display='block';
    c.style.display='block';
  }
  else if(current.tipo==='ordenar'){
    renderOrder();
  }
  else if(current.tipo==='arrastrar'){
    renderDrag();
  }
  else if(current.tipo === 'listening'){ // Igual que HABLAR ¿?
    renderListening();
  } 
  else if(current.tipo === 'guess'){ // Se escucha y se adivina de entre opciones. ToDo: Que no se vea la pregunta
    renderListening();
  } 
  else if(current.tipo === 'pronunciar'){ // Se escucha y se escribe. ToDo: Que no se vea la pregunta
    renderPronunciation();
  }
  else if (current.tipo === 'hablar') { // Se escucha y se habla. ToDo: Que no se vea la pregunta
    renderSpeaking();
  }
  else if(current.tipo === 'cual_no_encaja'){
    renderNoEncaja();
  }
  else if(current.tipo === 'clasificar'){ // No funciona de momento (sólo la pregunta, pero no hay ni opciones ni botones)
    renderClasificar();
  }
  else if(current.tipo === 'completar'){ // No funciona de momento (solo aparece la pregunta en negrita y la respuesta más abajo, no hay opciones
    renderCompletar();
  }
  else{
    current.opciones.split('|').forEach(o=>{
      const b=document.createElement('button');
      b.innerText=o;
      b.onclick=()=>finish(normalize(o)===normalize(current.respuesta));
      a.appendChild(b);
    });
  }
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================ FUNCIONALIDADES =================================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function shuffle(array){
  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array; // devuelve el array para que puedas asignarlo si quieres
}

function normalize(t){ return t.trim().toLowerCase(); }

function normalizarNombre(nombre){
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function checkWrite(){
  finish(normalize(document.getElementById('writeAnswer').value)
        === normalize(current.respuesta));
}

function finish(ok) {
  const btn = getEventTarget();
  ok ? handleCorrect(btn) : handleError(btn);
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================ TIPOS DE PREGUNTAS ================================================ */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

/* ================== COMPLETAR ================== */

function renderCompletar(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  if (!current.opciones || !current.respuesta) {
    a.innerHTML = '<em>Error en los datos de la pregunta</em>';
    return;
  }

  // Frase con hueco
  const frase = document.createElement('div');
  frase.style.fontSize = '1.2rem';
  frase.style.marginBottom = '12px';
  frase.innerHTML = current.pregunta.replace('___', '<strong>_____</strong>');
  a.appendChild(frase);

  // Opciones
  const opciones = shuffle(current.opciones.split('|')); // No menclarArray, que no existe

  opciones.forEach(op=>{
    const b = document.createElement('button');
    b.innerText = op;
    b.style.display = 'block';
    b.style.width = '80%';
    b.style.margin = '8px auto';

    b.onclick = ()=>{
      const ok = normalize(op) === normalize(current.respuesta);
      finish(ok);
    };

    a.appendChild(b);
  });
}

/* ================== CLASIFICAR ================== */

function renderClasificar(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  let selectedItem = null;

  // Parsear categorías
  const categorias = current.respuesta.split('|').map(c => {
    const [nombre, items] = c.split(':');
    return {
      nombre,
      items: items.split(',').map(normalize),
      colocados: []
    };
  });

  // 🔧 Elementos salen de las categorías
  const elementos = shuffle(
    categorias.flatMap(c => c.items)
  );

  // Contenedor general
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '20px';
  wrap.style.justifyContent = 'center';
  wrap.style.flexWrap = 'wrap';

  // Zona elementos
  const pool = document.createElement('div');
  pool.style.border = '2px dashed #999';
  pool.style.padding = '10px';
  pool.style.minWidth = '180px';
  pool.innerText = 'Elementos';

  elementos.forEach(txt=>{
    const el = document.createElement('div');
    el.innerText = txt;
    el.style.padding = '8px';
    el.style.margin = '6px';
    el.style.border = '1px solid #333';
    el.style.background = '#f0f8ff';
    el.style.cursor = 'pointer';

    el.onclick = ()=>{
      selectedItem = el;
      highlight(el, pool);
    };

    pool.appendChild(el);
  });

  wrap.appendChild(pool);

  // Zonas de categorías
  categorias.forEach(cat=>{
    const box = document.createElement('div');
    box.style.border = '2px solid #333';
    box.style.padding = '10px';
    box.style.minWidth = '180px';

    const title = document.createElement('strong');
    title.innerText = cat.nombre;
    box.appendChild(title);

    box.onclick = ()=>{
      if(!selectedItem) return;

      const value = normalize(selectedItem.innerText);
      const correcta = cat.items.includes(value);

      if(correcta){
        selectedItem.style.background = '#d4f8d4';
        box.appendChild(selectedItem);
        cat.colocados.push(value);

        registrarEvento("Acierto");
        visualAcierto(selectedItem);
      }else{
        selectedItem.style.background = '#ffd6d6';
        setTimeout(()=> selectedItem.style.background = '#f0f8ff', 600);

        registrarEvento("Error");
        visualError(selectedItem);
        handleIncorrect();
      }

      selectedItem = null;

      const totalCorrectos = categorias.reduce((acc,c)=>acc+c.items.length,0);
      const colocados = categorias.reduce((acc,c)=>acc+c.colocados.length,0);

      if(colocados === totalCorrectos){
        document.getElementById('feedback').innerText = '🌟 ¡Muy bien!';
        score++;
        animarPuntos();
        document.getElementById('score').innerText = score;
        disableAnswerControls();
        document.getElementById('next').style.display = 'block';
      }
    };

    wrap.appendChild(box);
  });

  a.appendChild(wrap);
}

/* ================== NO ENCAJA (¿Cuál no encaja?) ================== */

function renderNoEncaja(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción clara
  const info = document.createElement('div');
  info.innerText = '❓ ¿Cuál NO encaja?';
  info.style.fontWeight = '700';
  info.style.marginBottom = '8px';
  a.appendChild(info);

  // Crear lista de opciones como botones (aleatorizadas)
  const opts = shuffle(current.opciones.split('|').map(s => s.trim()).filter(Boolean));
  opts.forEach(o=>{
    const b = document.createElement('button');
    b.innerText = o;
    b.style.display = 'block';
    b.style.width = '86%';
    b.style.maxWidth = '640px';
    b.style.margin = '8px auto';
    b.style.padding = '12px';
    b.style.fontSize = '16px';

    // Al hacer clic comprobamos si esa opción es la que no encaja
    b.onclick = ()=> finish(normalize(o) === normalize(current.respuesta));

    a.appendChild(b);
  });

}

/* ================== HABLAR / SPEAKING ==================

   Tipo: 'hablar' (o 'speaking')
   - Reproduce audio (TTS por defecto, o URL en current.extra)
   - Permite grabar al alumno y transcribir en vivo si SpeechRecognition está disponible
   - Evalúa la transcripción comparándola con current.respuesta usando Levenshtein
*/

function renderSpeaking(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción
  const info = document.createElement('div');
  info.innerText = '🎤 Repite lo que oyes:';
  info.style.fontWeight = '700';
  info.style.marginBottom = '8px';
  a.appendChild(info);

  // Contenedor audio / play
  const audioContainer = document.createElement('div');
  audioContainer.style.textAlign = 'center';
  audioContainer.style.marginBottom = '12px';
  a.appendChild(audioContainer);

  // Botón reproducir (puede usar URL si current.extra)
  const playBtn = document.createElement('button');
  playBtn.id = 'playSpeakBtn';
  playBtn.innerText = '🔊 Escuchar';
  playBtn.style.display = 'block';
  playBtn.style.margin = '10px auto';
  playBtn.style.padding = '12px 18px';
  playBtn.style.fontSize = '18px';
  playBtn.setAttribute('aria-pressed','false');
  audioContainer.appendChild(playBtn);

  // Si extra contiene URL, usamos <audio>, si no usamos TTS con playListeningText
  const hasAudioUrl = current.extra && /^https?:\/\//i.test(current.extra.trim());
  let audioEl = null;
  if(hasAudioUrl){
    audioEl = document.createElement('audio');
    audioEl.src = current.extra.trim();
    audioEl.preload = 'auto';
    audioContainer.appendChild(audioEl);
  }

  playBtn.onclick = () => {
    if(audioEl){
      if(!audioEl.paused){
        audioEl.pause();
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      } else {
        audioEl.currentTime = 0;
        audioEl.play().catch(()=>{});
        playBtn.innerText = '▶️ Reproduciendo...';
        playBtn.setAttribute('aria-pressed','true');
        audioEl.onended = ()=> {
          playBtn.innerText = '🔊 Escuchar';
          playBtn.setAttribute('aria-pressed','false');
        };
      }
      return;
    }
    if(listeningUtterance){
      stopListeningPlayback();
      playBtn.innerText = '🔊 Escuchar';
      playBtn.setAttribute('aria-pressed','false');
      return;
    }
    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    // Reproducimos la respuesta (texto objetivo) por TTS
    playListeningText(current.respuesta || current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  // ======================================================
  // Controles de grabación / reconocimiento
  // ======================================================
  const recContainer = document.createElement('div');
  recContainer.style.textAlign = 'center';
  recContainer.style.marginTop = '8px';
  a.appendChild(recContainer);

  const recBtn = document.createElement('button');
  recBtn.innerText = '🔴 Grabar';
  recBtn.style.margin = '6px';

  const stopRecBtn = document.createElement('button');
  stopRecBtn.innerText = '⏹ Parar';
  stopRecBtn.style.margin = '6px';
  stopRecBtn.disabled = true;

  const playRecBtn = document.createElement('button');
  playRecBtn.innerText = '▶️ Reproducir mi grabación';
  playRecBtn.style.margin = '6px';
  playRecBtn.disabled = true;

  recContainer.appendChild(recBtn);
  recContainer.appendChild(stopRecBtn);
  recContainer.appendChild(playRecBtn);

  // Área para mostrar transcripción automática (si hay)
  const autoTransDiv = document.createElement('div');
  autoTransDiv.style.marginTop = '8px';
  autoTransDiv.style.minHeight = '28px';
  autoTransDiv.id = 'autoTranscription';
  a.appendChild(autoTransDiv);

  // audio element para reproducir la grabación local
  let recordedAudioEl = document.createElement('audio');
  recordedAudioEl.controls = false;
  recordedAudioEl.style.display = 'block';
  recordedAudioEl.style.margin = '8px auto';
  a.appendChild(recordedAudioEl);

  // Variables de recording
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedBlob = null;

  // SpeechRecognition si está disponible
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let recognizer = null;
  let interimTranscript = '';
  let finalTranscript = '';

  // normalizador para comparar (quita acentos y puntuación)
  function normalizeForCompare(t){
    if(!t && t !== '') return '';
    return String(t).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]|_/g, "")
      .replace(/\s+/g, ' ');
  }

  // Levenshtein (local pequeño)
  function levenshtein(a,b){
    if(a===b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    const matrix = Array.from({length: al+1}, (_,i) => Array(bl+1).fill(0));
    for(let i=0;i<=al;i++) matrix[i][0] = i;
    for(let j=0;j<=bl;j++) matrix[0][j] = j;
    for(let i=1;i<=al;i++){
      for(let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[al][bl];
  }

  // evaluación: devuelve true/false según tolerancia
  function evaluateTranscription(transcript){
    const expectedRaw = current.respuesta || current.pregunta || '';
    const aNorm = normalizeForCompare(expectedRaw);
    const tNorm = normalizeForCompare(transcript || '');

    if(aNorm === tNorm) return true;

    const dist = levenshtein(aNorm, tNorm);
    const allowed = Math.max(1, Math.floor(aNorm.length * 0.20)); // 20% de la longitud
    return dist <= allowed;
  }

  // Start recording + start recognizer (si existe)
  recBtn.onclick = async () => {
    // pedir micrófono
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(err){
      console.error('No se pudo acceder al micrófono', err);
      const f = document.getElementById('feedback');
      if(f) f.innerText = '⛔ No se pudo acceder al micrófono. Comprueba permisos.';
      return;
    }

    recordedChunks = [];
    const options = {};
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options.mimeType = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) options.mimeType = 'audio/ogg;codecs=opus';

    try { mediaRecorder = new MediaRecorder(mediaStream, options); }
    catch(e){ mediaRecorder = new MediaRecorder(mediaStream); }

    mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) recordedChunks.push(e.data); };

    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || 'audio/webm' });
      const url = URL.createObjectURL(recordedBlob);
      recordedAudioEl.src = url;
      playRecBtn.disabled = false;
      const f = document.getElementById('feedback');
      if(f) f.innerText = '✅ Grabación lista';
      // Si no hay reconocimiento disponible avisamos que la evaluación automática no existe
      if(!SpeechRecognition){
        autoTransDiv.innerText = 'ℹ️ Evaluación automática no disponible en este navegador. La grabación se puede escuchar y descargar.';
      }
      // liberamos micrófono
      if(mediaStream){
        mediaStream.getTracks().forEach(t=>t.stop());
        mediaStream = null;
      }
    };

    mediaRecorder.start();

    // Iniciar SpeechRecognition en paralelo si existe
    finalTranscript = '';
    interimTranscript = '';
    autoTransDiv.innerText = '';
    if(SpeechRecognition){
      try {
        recognizer = new SpeechRecognition();
        recognizer.lang = 'en-US'; // adaptalo según tu curso
        recognizer.interimResults = true;
        recognizer.maxAlternatives = 1;

        recognizer.onresult = (event) => {
          interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          autoTransDiv.innerText = '📝 ' + (finalTranscript + interimTranscript);
        };

        recognizer.onerror = (ev) => {
          console.warn('SpeechRecognition error', ev);
        };

        recognizer.onend = () => {
          // al terminar reconocimiento (por silencio o stop), evaluamos si tenemos transcript
          const overall = (finalTranscript || '').trim();
          if(overall){
            autoTransDiv.innerText = '📝 Transcripción automática: ' + overall;
            const ok = evaluateTranscription(overall);
            // Llamamos a finish con el resultado (acierto/ fallo)
            finish(ok);
          } else {
            // no se recogió nada
            autoTransDiv.innerText = '⚠ No se detectó voz claramente. Intenta de nuevo en un sitio más silencioso.';
            finish(false);
          }
        };

        recognizer.start();
      } catch(e){
        console.warn('No se pudo iniciar SpeechRecognition', e);
      }
    }

    // UI toggles
    recBtn.disabled = true;
    stopRecBtn.disabled = false;
    playRecBtn.disabled = true;
    const f = document.getElementById('feedback');
    if(f) f.innerText = '🎤 Grabando...';
  };

  // Stop recording: detiene MediaRecorder y SpeechRecognition (si existe)
  stopRecBtn.onclick = () => {
    try { if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch(e){}
    try { if(recognizer) { recognizer.stop(); recognizer = null; } } catch(e){}
    stopRecBtn.disabled = true;
    recBtn.disabled = false;
  };

  // Reproducir la grabación local
  playRecBtn.onclick = () => {
    try { recordedAudioEl.play(); } catch(e){}
  };

  // Permitir reintentos: dejamos que el nextQ / handleError controlen intentos
  // Nota: finish(true/false) ya se llama automáticamente cuando el recognizer finaliza (si hay)
  // Si no hay recognizer, no llamamos finish: queda a revisión manual (o puedes decidir enviar blob a servidor)

  // Si SpeechRecognition no existe, ofrecemos subir la grabación para revisión (opcional)
  if(!SpeechRecognition){
    const uploadBtn = document.createElement('button');
    uploadBtn.innerText = '⬆ Enviar grabación para revisión';
    uploadBtn.style.display = 'block';
    uploadBtn.style.margin = '8px auto';
    uploadBtn.onclick = () => {
      if(!recordedBlob){
        const f = document.getElementById('feedback');
        if(f) f.innerText = '⚠ Graba primero antes de enviar.';
        return;
      }
      // ejemplo de envío: (descomenta / adapta si tienes endpoint)
      /*
      const fd = new FormData();
      fd.append('file', recordedBlob, (current.id || 'rec') + '.webm');
      fd.append('alumno', usuarioActual || 'anon');
      fd.append('id_pregunta', current.id || '');
      fetch('/upload-audio', { method: 'POST', body: fd })
        .then(r => r.json()).then(res => { console.log(res); })
        .catch(err => console.error(err));
      */
      const f = document.getElementById('feedback');
      if(f) f.innerText = '✅ (Simulado) Grabación lista para enviar. Implementa /upload-audio si quieres guardar.';
    };
    a.appendChild(uploadBtn);
  }

  // foco y sugerencia UX
  setTimeout(()=>{ recBtn.focus(); }, 200);
}

/* ================== PRONUNCIACIÓN / DICTADO ================== */

/* Tipo: 'pronunciar' (o 'dictado')
   - reproduce audio (TTS por defecto, o URL si current.extra contiene una URL http(s))
   - muestra input para escribir lo escuchado y botón comprobar
   - compara con tolerancia (Levenshtein)
*/

function renderPronunciation(){
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Instrucción
  const info = document.createElement('div');
  info.innerText = '🔊 Escucha y escribe lo que oigas:';
  info.style.fontWeight = '700';
  info.style.marginBottom = '8px';
  a.appendChild(info);

  // Contenedor para el botón de reproducir y posibles controles de audio
  const audioContainer = document.createElement('div');
  audioContainer.style.textAlign = 'center';
  audioContainer.style.marginBottom = '12px';
  a.appendChild(audioContainer);

  // Botón de reproducir (reutilizamos el patrón de renderListening)
  const playBtn = document.createElement('button');
  playBtn.id = 'playPronunciationBtn';
  playBtn.innerText = '🔊 Escuchar';
  playBtn.style.display = 'block';
  playBtn.style.margin = '10px auto';
  playBtn.style.padding = '12px 18px';
  playBtn.style.fontSize = '18px';
  playBtn.setAttribute('aria-pressed','false');

  // Si current.extra es una URL http(s) válida, reproducimos ese audio en vez de TTS
  const hasAudioUrl = current.extra && /^https?:\/\//i.test(current.extra.trim());
  let audioEl = null;
  if(hasAudioUrl){
    audioEl = document.createElement('audio');
    audioEl.src = current.extra.trim();
    // no mostrar controles por defecto (botón ya lo controla)
    audioEl.preload = 'auto';
    audioContainer.appendChild(audioEl);
  }

  playBtn.onclick = () => {
    // Si hay audio nativo, reproducir / pausar ese audio
    if(audioEl){
      if(!audioEl.paused){
        audioEl.pause();
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      } else {
        audioEl.currentTime = 0;
        audioEl.play().catch(()=>{ /* ignore */ });
        playBtn.innerText = '▶️ Reproduciendo...';
        playBtn.setAttribute('aria-pressed','true');
        audioEl.onended = () => {
          playBtn.innerText = '🔊 Escuchar';
          playBtn.setAttribute('aria-pressed','false');
        };
      }
      return;
    }

    // Si no hay URL, usar TTS con la frase objetivo (current.pregunta si quieres que sea la frase,
    // o current.respuesta si prefieres reproducir la respuesta exacta). Aquí uso current.respuesta
    // para que lo que se escucha sea lo esperado a escribir.
    if(listeningUtterance){ // si ya está reproduciendo
      stopListeningPlayback();
      playBtn.innerText = '🔊 Escuchar';
      playBtn.setAttribute('aria-pressed','false');
      return;
    }

    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    // Reutiliza playListeningText (define en tu script) — forzamos idioma inglés
    // reproducimos current.respuesta (asume la transcripción correcta). Si prefieres reproducir
    // otra cosa, ajusta aquí.
    playListeningText(current.respuesta || current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  audioContainer.appendChild(playBtn);

  // Mostrar input y botón comprobar (usa los mismos elementos de tu UI para compatibilidad)
  const write = document.getElementById('writeAnswer');
  const check = document.getElementById('checkBtn');

  // Aseguramos que existan; si no, los creamos dinámicamente
  if(!write){
    const w = document.createElement('input');
    w.type = 'text';
    w.id = 'writeAnswer';
    w.setAttribute('aria-label','Escribe lo que oíste');
    w.style.display = 'block';
    w.style.width = '86%';
    w.style.margin = '8px auto';
    w.style.padding = '12px';
    a.appendChild(w);
  } else {
    write.value = '';
    write.style.display = 'block';
  }

  if(!check){
    const cb = document.createElement('button');
    cb.id = 'checkBtn';
    cb.innerText = 'Comprobar';
    cb.style.display = 'block';
    cb.style.margin = '8px auto';
    cb.onclick = checkPronunciation;
    a.appendChild(cb);
  } else {
    check.style.display = 'block';
    check.onclick = checkPronunciation;
  }

  // small helper: normalización (similar a normalize pero quitamos puntuación)
  function normalizeForCompare(t){
    if(!t && t !== '') return '';
    // convertir a string, quitar acentos, minusculas, quitar puntuación y espacios extras
    let s = String(t).trim().toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\w\s]|_/g, "")   // quita signos de puntuación
              .replace(/\s+/g, ' ');       // colapsa espacios multiples
    return s;
  }

  // Levenshtein simple para tolerancia
  function levenshtein(a,b){
    if(a===b) return 0;
    const al = a.length, bl = b.length;
    if(al === 0) return bl;
    if(bl === 0) return al;
    const matrix = Array.from({length: al+1}, (_,i) => Array(bl+1).fill(0));
    for(let i=0;i<=al;i++) matrix[i][0] = i;
    for(let j=0;j<=bl;j++) matrix[0][j] = j;
    for(let i=1;i<=al;i++){
      for(let j=1;j<=bl;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j-1] + cost
        );
      }
    }
    return matrix[al][bl];
  }

  // Comprueba la respuesta con tolerancia
  function checkPronunciation(){
    const user = (document.getElementById('writeAnswer') || document.querySelector('#answers input')).value || '';
    const expectedRaw = current.respuesta || current.pregunta || '';
    const aNorm = normalizeForCompare(expectedRaw);
    const uNorm = normalizeForCompare(user);

    // exact match rápido
    if(aNorm === uNorm){
      finish(true);
      return;
    }

    // tolerancia basada en longitud: aceptamos pequeñas faltas
    const dist = levenshtein(aNorm, uNorm);
    const allowed = Math.max(1, Math.floor(aNorm.length * 0.15)); // 15% del tamaño, mínimo 1

    if(dist <= allowed){
      finish(true);
    } else {
      finish(false);
    }
  }

  // foco en el input para que el alumno pueda escribir tras escuchar
  setTimeout(()=> {
    const w = document.getElementById('writeAnswer');
    if(w) w.focus();
  }, 200);
}

/* ================== LISTENING ================== */

let speechSupported = 'speechSynthesis' in window;
let listeningUtterance = null;

function renderListening(){
  console.log('Opciones actuales:', current.opciones); // <--- Audit
  const a = document.getElementById('answers');
  a.innerHTML = '';

  // Contenedor para audio
  const audioContainer = document.createElement('div');
  audioContainer.style.textAlign = 'center';
  audioContainer.style.marginBottom = '12px';
  a.appendChild(audioContainer);

  // Botón grande para reproducir
  const playBtn = document.createElement('button');
  playBtn.id = 'playListeningBtn';
  playBtn.innerText = '🔊 Escuchar en inglés';
  playBtn.style.display = 'block';
  playBtn.style.margin = '10px auto';
  playBtn.style.padding = '12px 18px';
  playBtn.style.fontSize = '18px';
  playBtn.setAttribute('aria-pressed','false');

  playBtn.onclick = () => {
    if(listeningUtterance) { 
      stopListeningPlayback(); 
      playBtn.innerText = '🔊 Escuchar en inglés'; 
      playBtn.setAttribute('aria-pressed','false'); 
      return; 
    }

    playBtn.innerText = '▶️ Reproduciendo...';
    playBtn.setAttribute('aria-pressed','true');

    playListeningText(current.pregunta,
      () => {},
      () => {
        playBtn.innerText = '🔊 Escuchar en inglés';
        playBtn.setAttribute('aria-pressed','false');
      },
      (err) => {
        console.error('TTS error', err);
        playBtn.innerText = '🔊 Escuchar en inglés';
        playBtn.setAttribute('aria-pressed','false');
        const f = document.getElementById('feedback');
        if(f) f.innerText = '🔈 No se pudo reproducir el audio en este navegador.';
      }
    );
  };

  audioContainer.appendChild(playBtn);

  // Renderizar siempre las opciones si existen
  console.log('Opciones para renderizar:', current.opciones);
  if(current.opciones && current.opciones.trim() !== ''){
    const optsContainer = document.createElement('div');
    optsContainer.style.marginTop = '16px';
    a.appendChild(optsContainer);

    const opts = shuffle(current.opciones.split('|'));
    opts.forEach(o=>{
      const b = document.createElement('button');
      b.innerText = o;
      b.style.display = 'block';
      b.style.width = '80%';
      b.style.margin = '8px auto';
      b.style.padding = '8px';
      b.style.fontSize = '16px';
      b.onclick = ()=> finish(normalize(o) === normalize(current.respuesta));
      optsContainer.appendChild(b);
    });
  }
}

// Elige la voz inglesa preferida (opcional: se itera para preferir en-US > en-GB)
function chooseEnglishVoice() {
  const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  if(!voices || !voices.length) return null;
  // preferencias: en-US, en-GB, cualquier en-*
  let v = voices.find(v=>/en-US/i.test(v.lang)) ||
          voices.find(v=>/en-GB/i.test(v.lang)) ||
          voices.find(v=>/^en\b/i.test(v.lang));
  return v || voices[0];
}

function playListeningText(text, onStart, onEnd, onError) {
  if(!speechSupported){
    if(onError) onError(new Error('SpeechSynthesis no soportado'));
    return;
  }

  // Cancelar cualquier reproducción previa
  try { speechSynthesis.cancel(); } catch(e){}

  listeningUtterance = new SpeechSynthesisUtterance(String(text));
  listeningUtterance.lang = 'en-US'; // forzar inglés; cambiar a 'en-GB' si prefieres
  const voice = chooseEnglishVoice();
  if(voice) listeningUtterance.voice = voice;

  listeningUtterance.onstart = () => { if(onStart) onStart(); };
  listeningUtterance.onend = () => { if(onEnd) onEnd(); listeningUtterance = null; };
  listeningUtterance.onerror = (ev) => { if(onError) onError(ev.error || ev); listeningUtterance = null; };

  // velocidad y tono se pueden ajustar si quieres:
  listeningUtterance.rate = 0.95;    // 0.8 - 1.2 rangos útiles para niños
  listeningUtterance.pitch = 1.0;

  try {
    speechSynthesis.speak(listeningUtterance);
  } catch(e) {
    if(onError) onError(e);
  }
}

function stopListeningPlayback() {
  try { speechSynthesis.cancel(); } catch(e){}
  listeningUtterance = null;
}

/* ================== ORDENAR ================== */

let touchItems = [];

function renderOrder(){
  const a = document.getElementById('answers');
  a.innerHTML = '';
  touchItems = [];

  const info = document.createElement('div');
  info.innerText = '👉 Arrastra arriba o abajo para ordenar:';
  a.appendChild(info);

  const list = document.createElement('div');
  list.id = 'orderList';
  list.style.border = '2px dashed #999';
  list.style.padding = '10px';

  const items = current.opciones.split('|').sort(()=>Math.random()-0.5);

  items.forEach(text=>{
    const el = document.createElement('div');
    el.innerText = text;
    el.style.padding = '10px';
    el.style.margin = '5px';
    el.style.background = '#f0f8ff';
    el.style.border = '1px solid #333';
    el.style.touchAction = 'none';

    enableTouchReorder(el, list);
    list.appendChild(el);
    touchItems.push(el);
  });

  a.appendChild(list);

  const resetBtn = document.createElement('button');
  resetBtn.innerText = '🔄 Empezar de nuevo';
  resetBtn.onclick = renderOrder;
  a.appendChild(resetBtn);

  const checkBtn = document.createElement('button');
  checkBtn.innerText = '✅ Comprobar';
  checkBtn.onclick = checkOrderTouch;
  a.appendChild(checkBtn);
}

// LOGICA TACTIL
function enableTouchReorder(item, container){
  let startY = 0;
  let currentY = 0;

  item.addEventListener('touchstart', e=>{
    startY = e.touches[0].clientY;
    item.classList.add('moving');
  });

  item.addEventListener('touchmove', e=>{
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;

    item.style.transform = `translateY(${dy}px)`;

    const siblings = [...container.children].filter(c=>c!==item);
    siblings.forEach(sib=>{
      const box = sib.getBoundingClientRect();
      if(currentY > box.top && currentY < box.bottom){
        if(dy > 0){
          container.insertBefore(item, sib.nextSibling);
        }else{
          container.insertBefore(item, sib);
        }
      }
    });
  });

  item.addEventListener('touchend', ()=>{
    item.style.transform = '';
    item.classList.remove('moving');
  });
}

// COMPROBAR ORDEN
function checkOrderTouch(){
  const items = [...document.querySelectorAll('#orderList div')]
    .map(d=>normalize(d.innerText));

  const correct = current.respuesta.split('|').map(normalize);

  if(JSON.stringify(items) === JSON.stringify(correct)){
    handleCorrect(getEventTarget());
  }else{
    handleError(getEventTarget());
  }
}

/* ================== ARRASTRAR ================== */

let selectedLeft = null;

function renderDrag(){
  const a = document.getElementById('answers');
  a.innerHTML = '';
  selectedLeft = null;

  const left = current.opciones.split('|');
  const right = current.respuesta.split('|').sort(()=>Math.random()-0.5);

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '30px';

  const L = document.createElement('div');
  const R = document.createElement('div');

  left.forEach(t=>{
    const d = document.createElement('div');
    d.innerText = t;
    d.style.padding = '10px';
    d.style.border = '1px solid black';
    d.style.cursor = 'pointer';

    d.onclick = ()=>{
      // quitar resalto anterior si existía
      if(selectedLeft) selectedLeft.classList.remove('highlight');

      // seleccionar y resaltar el nuevo
      selectedLeft = d;
      d.classList.add('highlight');
    };

    L.appendChild(d);
  });

  right.forEach(t=>{
    const d = document.createElement('div');
    d.innerText = t;
    d.style.padding = '10px';
    d.style.border = '1px solid black';
    d.style.cursor = 'pointer';

    d.onclick = ()=>{
      if(!selectedLeft) return;

      const i = left.indexOf(selectedLeft.innerText);
      const correcta = current.respuesta.split('|')[i] === t;

      // feedback visual LOCAL
      if(correcta){
        d.style.background = '#d3f9d8';
        d.dataset.ok = '1';
      }else{
        d.style.background = '#ffe3e3';
        d.dataset.ok = '0';
      }

      // deseleccionar y quitar resalto de la izquierda
      selectedLeft.style.opacity = 0.5;
      selectedLeft.classList.remove('highlight');
      selectedLeft = null;

      // ¿hemos terminado todos?
      const total = left.length;
      const ok = document.querySelectorAll('[data-ok="1"]').length;
      const done = document.querySelectorAll('[data-ok]').length;

      if (done === total) {
        if (ok === total) {
          handleCorrect(null);
        } else {
          handleError(null);
        }
      }
    };

    R.appendChild(d);
  });

  wrap.appendChild(L);
  wrap.appendChild(R);
  a.appendChild(wrap);
}

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ========================================== EFECTOS VISUALES Y SONIDOS ============================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

// Confetti simple (genera pequeñas piezas y las anima)
// Asegura que exista un contenedor dentro de la tarjeta para el confeti
function ensureConfettiContainer(){
  let card = document.querySelector('.game-card') || document.body;
  // forzar position relative en la card para que los absolute internos funcionen
  const cardStyle = getComputedStyle(card).position;
  if(cardStyle === 'static'){
    card.style.position = 'relative';
  }
  let c = card.querySelector('#confetti-container');
  if(!c){
    c = document.createElement('div');
    c.id = 'confetti-container';
    card.appendChild(c);
  }
  return c;
}

function launchConfetti(target = null, count = 22){
  const container = ensureConfettiContainer();

  // calcular punto central donde "estallar"
  let origin = { x: container.clientWidth/2, y: container.clientHeight/3 };

  if(target instanceof HTMLElement){
    const tRect = target.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    // coordenadas relativas al contenedor
    origin.x = (tRect.left + tRect.right)/2 - cRect.left;
    origin.y = (tRect.top + tRect.bottom)/2 - cRect.top;
  } else if(typeof target === 'object' && typeof target.x === 'number' && typeof target.y === 'number'){
    origin.x = target.x;
    origin.y = target.y;
  } else if(typeof target === 'number'){
    // si llamaron launchConfetti(x,y,count) con x numérico: (no usado aquí)
    // dejar por defecto
  }

  const colors = ['#ff6b6b','#ffd93d','#6bd4ff','#9b8cff','#7ee787'];

  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = (origin.x + (Math.random()*120 - 60)) + 'px';
    el.style.top = (origin.y + (Math.random()*40 - 20)) + 'px';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.opacity = 1;
    el.style.width = (8 + Math.random()*8) + 'px';
    el.style.height = (10 + Math.random()*8) + 'px';

    // movimiento: usaremos transform + transition para "subir" y rotar
    const duration = 1200 + Math.random()*900;
    el.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1), opacity ${duration/1.6}ms linear`;
    container.appendChild(el);

    // forzar un pequeño delay para que la transición se aplique
    requestAnimationFrame(() => {
      // el movimiento aleatorio hacia arriba + lateral
      const dx = (Math.random()*220 - 110);
      const dy = -(140 + Math.random()*120); // negativa = sube
      const rz = (Math.random()*720 - 360);
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rz}deg)`;
      el.style.opacity = '0';
    });

    // borrar después de la animación
    setTimeout(()=>{ if(el && el.parentNode) el.parentNode.removeChild(el); }, duration + 250);
  }
}

// micro-sonidos con WebAudio
const audioCtx = (typeof AudioContext !== 'undefined') ? new AudioContext() : null;
function playTone(freq = 440, dur = 0.12, type='sine'){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.01);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  setTimeout(()=>{ o.stop(); }, dur*1000 + 50);
}

function animarPuntos(){
  const s = document.getElementById('score');
  if(!s) return;
  s.classList.add('bump');
  setTimeout(()=>s.classList.remove('bump'), 300);
}

// llamar al a/fracaso visualmente
function visualAcierto(btn){
  if(btn) btn.classList.add('btn-correct');
  launchConfetti(window.innerWidth/2, window.innerHeight/3, 28);
  playTone(950, 0.12, 'sine');
  // quitar clase tras animación
  setTimeout(()=>{ if(btn) btn.classList.remove('btn-correct'); }, 900);
}
function visualError(btn){
  if(btn) btn.classList.add('btn-wrong');
  playTone(220, 0.18, 'sawtooth');
  setTimeout(()=>{ if(btn) btn.classList.remove('btn-wrong'); }, 700);
}

// Opciones del combo bonitas:
// Custom dropdown for subject (mantiene el select oculto sincronizado)
(function(){
  const toggle = document.getElementById('subject-toggle');
  const list = document.getElementById('subject-list');
  const current = document.getElementById('subject-current');
  const nativeSelect = document.getElementById('subject'); // hidden select

  if(!toggle || !list) return;

  // Toggle open/close
  toggle.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    list.style.display = expanded ? 'none' : 'block';
    if(!expanded){
      // focus first item for keyboard users
      const first = list.querySelector('li');
      if(first) first.focus();
    }
  });

  // choose item
  list.querySelectorAll('li').forEach(li=>{
    li.tabIndex = 0;
    li.addEventListener('click', ()=>{
      // mark UI
      list.querySelectorAll('li').forEach(x=>x.setAttribute('aria-selected','false'));
      li.setAttribute('aria-selected','true');
      current.innerText = li.innerText;
      list.style.display = 'none';
      toggle.setAttribute('aria-expanded','false');

      // update hidden select value for existing code compatibility
      if(nativeSelect){
        nativeSelect.value = li.getAttribute('data-value') || '';
      }
      // Recargar asignatura
      startGame();
    });

    // keyboard support (Enter/Space to select)
    li.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter' || ev.key === ' '){
        ev.preventDefault();
        li.click();
      } else if(ev.key === 'ArrowDown'){
        ev.preventDefault();
        const next = li.nextElementSibling || list.querySelector('li');
        if(next) next.focus();
      } else if(ev.key === 'ArrowUp'){
        ev.preventDefault();
        const prev = li.previousElementSibling || list.querySelector('li:last-child');
        if(prev) prev.focus();
      }
    });
  });

  // close if click outside
  document.addEventListener('click', (ev)=>{
    if(!toggle.contains(ev.target) && !list.contains(ev.target)){
      list.style.display = 'none';
      toggle.setAttribute('aria-expanded','false');
    }
  });

  // close on escape key
  document.addEventListener('keydown', (ev)=>{
    if(ev.key === 'Escape'){
      list.style.display = 'none';
      toggle.setAttribute('aria-expanded','false');
      toggle.focus();
    }
  });

  // Initialize display based on native select (if value preselected)
  if(nativeSelect && nativeSelect.value){
    const match = nativeSelect.value;
    const el = list.querySelector(`li[data-value="${match}"]`);
    if(el){
      el.setAttribute('aria-selected','true');
      current.innerText = el.innerText;
    }
  }

})();

/* ==================================================================================================================== */
/* ==================================================================================================================== */
/* ================================================== OBSERVABILIDAD ================================================== */
/* ==================================================================================================================== */
/* ==================================================================================================================== */

function getDeviceKey(){
  const ua = navigator.userAgent || 'unknown_ua';
  const platform = navigator.platform || 'unknown_platform';
  return `${platform} | ${ua}`;
}

// Función para enviar observabilidad
function registrarEvento(correcto) {
  enviarObservabilidad(correcto);
}

function enviarObservabilidad(resultado) {
  const formData = new FormData();
  //formData.append("fecha", new Date().toISOString());
  formData.append("fecha", new Date().toISOString().split('T')[0]); // Nuevo, sin hora
  formData.append("alumno", usuarioActual);
  formData.append("device_key", getDeviceKey()); // Nuevo
  formData.append("asignatura", preguntaActual.asignatura);
  formData.append("id_pregunta", preguntaActual.id);
  formData.append("tipo_pregunta", preguntaActual.tipo);
  formData.append("estado", resultado);

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: formData
  });
}

// reportar pregunta confusa
function reportar() {
  // Inicio observabilidad
  console.log("Registrando observabilidad")
  registrarEvento("Confusa")
  // Fin observabilidad
}
