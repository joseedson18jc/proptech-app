/* Boot: render first, then light up runtime capabilities when the viewer answers. */
(function (root) {
  "use strict";
  const App = root.App;
  App.boot();
  const hasRuntime = Boolean(root.claude && typeof root.claude.use === "function");
  if (hasRuntime) {
    root.claude.use("downloads").then((d) => {
      App.downloads = d;
      if (d && App.state.view === "dono") App.render();
    }).catch(() => { App.downloads = null; });
  }
  App.initCopilot();
})(typeof self !== "undefined" ? self : this);
