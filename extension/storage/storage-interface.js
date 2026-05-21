/**
 * AIKeep24-Lite Storage Interface
 */
var CK = window.CK;

CK.StorageInterface = {
  saveChunk:          function() { return Promise.reject(new Error('Not implemented')); },
  getChunksBySession: function() { return Promise.reject(new Error('Not implemented')); },
  getAllChunks:        function() { return Promise.reject(new Error('Not implemented')); },
  deleteChunk:        function() { return Promise.reject(new Error('Not implemented')); },
  count:              function() { return Promise.reject(new Error('Not implemented')); }
};
