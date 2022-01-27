let tree;
let allInitStates = [];
let nextStatePred = null;
let currState = null;
let currNextStates = [];
let currTrace = []
let specDefs = null;

// Given a state with primed and unprimed variables, remove the original
// unprimed variables and rename the primed variables to unprimed versions. 
function renamedPrimedVars(state){
    state = _.pickBy(state, (val,k,obj) => k.endsWith("'"));
    return _.mapKeys(state, (val,k,obj) => k.slice(0,k.length-1));
}

// TODO: Implement this properly.
function toggleSpec(){
    let pane = document.getElementById("input-pane");
    pane.style.width="0%";
}

function renderNextStateChoices(nextStates){
    let initStatesDiv = document.getElementById("initial-states");
    initStatesDiv.innerHTML = "";
    // initStatesDiv.innerHTML += "<div>"
    for(const state of nextStates){
        let stateDiv = document.createElement("div");
        stateDiv.classList.add("init-state");
        for(const varname in state){
            stateDiv.innerHTML += `<span class='state-varname'>${varname}</span> = `
            stateDiv.innerHTML += JSON.stringify(state[varname]);
            stateDiv.innerHTML += "<br>"
        }
        let hash = hashStateShort(state);
        stateDiv.setAttribute("onclick", `handleChooseState("${hash}")`);
        initStatesDiv.appendChild(stateDiv);
    }
}

// Step back one state in the current trace.
function traceStepBack(){
    currTrace = currTrace.slice(0, currTrace.length - 1);
    // Back to initial states.
    if(currTrace.length === 0){
        console.log("Back to initial states.")
        currNextStates = _.cloneDeep(allInitStates);
    } else{
        let lastState = currTrace[currTrace.length-1];
        let nextStates = getNextStates(nextStatePred, _.cloneDeep(lastState), specDefs)
            .map(c => c["state"])
            .map(renamedPrimedVars);
        currNextStates = _.cloneDeep(nextStates);
    }
    renderCurrentTrace();
    renderNextStateChoices(currNextStates);
}

function updateTraceLink(){
    var url_ob = new URL(document.URL);
    var traceHashes = currTrace.map(s => hashStateShort(s));
    console.log(traceHashes);
    url_ob.hash = '#' + traceHashes.join(",");

    // Save the trace as a comma separated list of short state hashes.
    var new_url = url_ob.href;
    document.location.href = new_url;
}

// Save the current trace in the URL.
function traceGetLink(){
    if(currTrace.length === 0){
        return;
    }
    updateTraceLink();
}

// Load a trace from URL link. Returns false if there is no link to load.
function loadTraceFromLink(){
    var url_ob = new URL(document.URL);
    console.log("URL hash:", url_ob.hash);
    if(url_ob.hash <= 1){
        return false;
    }
    var traceHashes = url_ob.hash.slice(1).split(",");
    console.log(traceHashes);

    for(var ind=0;ind<traceHashes.length;ind++){
        let shortHash = traceHashes[ind];
        handleChooseState(shortHash)
    }

    return true;
    // url_ob.hash = '#' + traceHashes.join(",");

    // Save the trace as a comma separated list of short state hashes
    // var new_url = url_ob.href;
    // document.location.href = new_url;
}

function renderCurrentTrace(){
    let traceDiv = document.getElementById("trace");
    traceDiv.innerHTML = "";
    console.log(trace);
    let stateInd = 0;
    for(var ind=0;ind < currTrace.length;ind++){
        let state = currTrace[ind];
        let isLastState = ind === currTrace.length - 1;
        let traceStateDiv = document.createElement("div");
        // traceStateDiv.innerHTML += "<b>State " + stateInd + "</b><br>"
        traceStateDiv.classList.add("trace-state");
        console.log(state);
        for(const varname in state){
            traceStateDiv.innerHTML += "<span><span class='state-varname'>" + varname +"</span> = "+ JSON.stringify(state[varname]) + "</span>";
            traceStateDiv.innerHTML += "<br>"
        }

        // let backButton = document.getElementById("trace-back-button");
        // backButton.setAttribute("hidden", "true");

        //     let backButton = document.createElement("div");


        // Remove in favor of back button at top of trace.
        // // If this is the last state, add a "step back" button.
        // if(isLastState){
        //     let backButton = document.createElement("div");
        //     backButton.innerHTML = "Back"
        //     backButton.id = "trace-back-button";
        //     backButton.setAttribute("onclick", `traceStepBack()`);
        //     traceStateDiv.appendChild(backButton);
        // }

        traceDiv.appendChild(traceStateDiv);
        stateInd += 1;
    }
    traceDiv.innerHTML += "<br><br>";
    
    let header = document.getElementById("poss-next-states-title");
    header.innerHTML = (currTrace.length > 0) ? "Choose Next State" : "Choose Initial State";

    updateTraceLink();

}

function handleChooseState(statehash_short){
    console.log("currNextStates:", JSON.stringify(currNextStates));
    let nextState = currNextStates.filter(s => hashStateShort(s)===statehash_short)[0];
    // TODO: Consider detecting cycles in the trace.
    currTrace.push(nextState);
    console.log("nextState:", JSON.stringify(nextState));
    console.log("nextStatePred:", nextStatePred);
    const start = performance.now();
    let nextStates = getNextStates(nextStatePred, _.cloneDeep(nextState), specDefs)
                        .map(c => c["state"])
                        .map(renamedPrimedVars);
    currNextStates = _.cloneDeep(nextStates);
    const duration = (performance.now() - start).toFixed(1);
    console.log(`Generation of next states took ${duration}ms`)


    // Re-render.
    renderCurrentTrace();
    renderNextStateChoices(currNextStates);
}

(async () => {

  const scriptURL = document.currentScript.getAttribute('src');

  const codeInput = document.getElementById('code-input');
  const languageSelect = document.getElementById('language-select');
  const loggingCheckbox = document.getElementById('logging-checkbox');
  const outputContainer = document.getElementById('output-container');
  const outputContainerScroll = document.getElementById('output-container-scroll');
  const playgroundContainer = document.getElementById('playground-container');
  const queryCheckbox = document.getElementById('query-checkbox');
  const queryContainer = document.getElementById('query-container');
  const queryInput = document.getElementById('query-input');
  const updateTimeSpan = document.getElementById('update-time');
  const languagesByName = {};

  loadState();

  await TreeSitter.init();
  const parser = new TreeSitter();

  let tree = null;

  var ASSIGN_PRIMED = false;

  const codeEditor = CodeMirror.fromTextArea(codeInput, {
    lineNumbers: true,
    showCursorWhenSelecting: true,
    // TODO: Work out tlaplus mode functionality for syntax highlighting.
    // mode:"tlaplus"
  });

//   const queryEditor = CodeMirror.fromTextArea(queryInput, {
//     lineNumbers: true,
//     showCursorWhenSelecting: true
//   });

//   const cluster = new Clusterize({
//     rows: [],
//     noDataText: null,
//     contentElem: outputContainer,
//     scrollElem: outputContainerScroll
//   });
//   const renderTreeOnCodeChange = debounce(renderTree, 50);
//   const saveStateOnChange = debounce(saveState, 2000);
//   const runTreeQueryOnChange = debounce(runTreeQuery, 50);

  let languageName = languageSelect.value;
  let treeRows = null;
  let treeRowHighlightedIndex = -1;
  let parseCount = 0;
  let isRendering = 0;
  let query;

  codeEditor.on('changes', handleCodeChange);
//   codeEditor.on('viewportChange', runTreeQueryOnChange);
//   codeEditor.on('cursorActivity', debounce(handleCursorMovement, 150));
//   queryEditor.on('changes', debounce(handleQueryChange, 150));

//   loggingCheckbox.addEventListener('change', handleLoggingChange);
//   queryCheckbox.addEventListener('change', handleQueryEnableChange);
//   languageSelect.addEventListener('change', handleLanguageChange);
//   outputContainer.addEventListener('click', handleTreeClick);

//   handleQueryEnableChange();
  await handleLanguageChange()

//   playgroundContainer.style.visibility = 'visible';

  async function handleLanguageChange() {
    const newLanguageName = languageSelect.value;
    if (!languagesByName[newLanguageName]) {
      const url = `${LANGUAGE_BASE_URL}/tree-sitter-${newLanguageName}.wasm`
      languageSelect.disabled = true;
      try {
        languagesByName[newLanguageName] = await TreeSitter.Language.load(url);
      } catch (e) {
        console.error(e);
        languageSelect.value = languageName;
        return
      } finally {
        languageSelect.disabled = false;
      }
    }

    tree = null;
    languageName = newLanguageName;
    parser.setLanguage(languagesByName[newLanguageName]);

    // Download example spec.
    // let specPath = "./specs/simple1.tla";
    // let specPath = "./specs/simple2.tla";
    // let specPath = "./specs/lockserver_nodefs.tla";
    // let specPath = "./specs/MongoLoglessDynamicRaft.tla";
    // let specPath = "./specs/Paxos.tla";
    // let specPath = "./specs/simple_test.tla";
    let specPath = "./specs/simple_lockserver.tla";
    (() => {
        const handle = setInterval(() => {
            res = $.get(specPath, data => {
                const $codeEditor = document.querySelector('.CodeMirror');
                spec = data;
                console.log("Retrieved spec:", specPath);
                if ($codeEditor) {
                    // code change handler should be triggered when we update the code mirror text.
                    $codeEditor.CodeMirror.setValue(spec);
                    $codeEditor.CodeMirror.setSize("100%", "100%");
                    clearInterval(handle);
                    // handleCodeChange();
                }
            });
        }, 500);
    })();
  }

  function genRandTrace(){
    
    // Pick a random element from the given array.
    function randChoice(arr){
        let randI = _.random(0, arr.length-1);
        return arr[randI];
    }


    const newText = codeEditor.getValue() + '\n';
    const newTree = parser.parse(newText, tree);

    objs = walkTree(newTree);
    let vars = objs["var_decls"];
    let defns = objs["op_defs"];

    let initDef = defns["Init"];
    let nextDef = defns["Next"];

    let initStates = getInitStates(initDef, vars);
    initStates = initStates.filter(ctx => ctx["val"]).map(ctx => ctx["state"]);

    // Pick a random initial state.
    let currState = randChoice(initStates);
    console.log("initState in trace:", currState);

    let max_trace_depth = 6;
    let curr_depth = 0;
    let trace = [_.cloneDeep(currState)];
    while(curr_depth < max_trace_depth){
        // Get next states from the current state and pick a random one.
        let nextStates = getNextStates(nextDef, currState);
        nextStates = nextStates.filter(ctx => ctx["val"]).map(ctx => ctx["state"]);
        // console.log(nextStates);
        let nextState = _.cloneDeep(randChoice(nextStates));
        // Rename primed variables to unprimed variables.
        nextState = _.pickBy(nextState, (val,k,obj) => k.endsWith("'"));
        nextState = _.mapKeys(nextState, (val,k,obj) => k.slice(0,k.length-1));
        console.log(nextState);
        // Process next state.
        currState = nextState;
        curr_depth += 1;
        trace.push(_.cloneDeep(currState));
    }

    // Display trace.
    let traceDiv = document.getElementById("trace");
    traceDiv.innerHTML = "";
    console.log(trace);
    let stateInd = 0;
    for(const state of trace){
        traceDiv.innerHTML += "<div>";
        traceDiv.innerHTML += "<b>State " + stateInd + "</b>"
        console.log(state);
        for(const varname in state){
            traceDiv.innerHTML += "<span>" + varname +": "+ JSON.stringify(state[varname]) + "</span>";
            traceDiv.innerHTML += "<br>"
        }
        traceDiv.innerHTML += "</div>";
        stateInd += 1;
    }
    traceDiv.innerHTML += "<br><br>";
  }

  async function handleCodeChange(editor, changes) {
    const newText = codeEditor.getValue() + '\n';
    const edits = tree && changes && changes.map(treeEditForEditorChange);

    const start = performance.now();
    if (edits) {
      for (const edit of edits) {
        tree.edit(edit);
      }
    }
    const newTree = parser.parse(newText, tree);
    const duration = (performance.now() - start).toFixed(1);

    // TODO: Consider what occurs when spec code changes after the
    // initial page load.
    console.log("Generating initial states.");
    let treeObjs = walkTree(newTree);
    specDefs = treeObjs["op_defs"];
    nextStatePred = treeObjs["op_defs"]["Next"]["node"];
    let initStates = computeInitStates(newTree);
    allInitStates = initStates;

    // Display states in HTML.
    let initStatesDiv = document.getElementById("initial-states");
    initStatesDiv.innerHTML = "";
    renderNextStateChoices(initStates);
    console.log("Rendered initial states");

    currNextStates = _.cloneDeep(initStates);

    // Check for trace to load from given link.
    loadTraceFromLink();
  }

  function handleCursorMovement() {
    if (isRendering) return;

    const selection = codeEditor.getDoc().listSelections()[0];
    let start = {row: selection.anchor.line, column: selection.anchor.ch};
    let end = {row: selection.head.line, column: selection.head.ch};
    if (
      start.row > end.row ||
      (
        start.row === end.row &&
        start.column > end.column
      )
    ) {
      let swap = end;
      end = start;
      start = swap;
    }
    const node = tree.rootNode.namedDescendantForPosition(start, end);
    if (treeRows) {
      if (treeRowHighlightedIndex !== -1) {
        const row = treeRows[treeRowHighlightedIndex];
        if (row) treeRows[treeRowHighlightedIndex] = row.replace('highlighted', 'plain');
      }
      treeRowHighlightedIndex = treeRows.findIndex(row => row.includes(`data-id=${node.id}`));
      if (treeRowHighlightedIndex !== -1) {
        const row = treeRows[treeRowHighlightedIndex];
        if (row) treeRows[treeRowHighlightedIndex] = row.replace('plain', 'highlighted');
      }
      cluster.update(treeRows);
      const lineHeight = cluster.options.item_height;
      const scrollTop = outputContainerScroll.scrollTop;
      const containerHeight = outputContainerScroll.clientHeight;
      const offset = treeRowHighlightedIndex * lineHeight;
      if (scrollTop > offset - 20) {
        $(outputContainerScroll).animate({scrollTop: offset - 20}, 150);
      } else if (scrollTop < offset + lineHeight + 40 - containerHeight) {
        $(outputContainerScroll).animate({scrollTop: offset - containerHeight + 40}, 150);
      }
    }
  }

  function loadState() {
    const language = localStorage.getItem("language");
    const sourceCode = localStorage.getItem("sourceCode");
    const query = localStorage.getItem("query");
    const queryEnabled = localStorage.getItem("queryEnabled");
    if (language != null && sourceCode != null && query != null) {
      queryInput.value = query;
      codeInput.value = sourceCode;
      languageSelect.value = language;
      queryCheckbox.checked = (queryEnabled === 'true');
    }
  }

  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }
})();
