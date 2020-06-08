(function(){
  // Start delegate $(document).on('event', 'element', function) on vanillaJs
  var CustomEvent = window.CustomEvent;

  if (typeof CustomEvent === 'function') {
    CustomEvent = function(event, params) {
      var evt;
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
    };
    CustomEvent.prototype = window.Event.prototype;
  }

  var fire = function(obj, name, data) {
    var event;
    event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail: data
    });

    obj.dispatchEvent(event);
    return !event.defaultPrevented;
  };

  var m = Element.prototype.matches || Element.prototype.matchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector || Element.prototype.webkitMatchesSelector;

  var matches = function(element, selector) {
    if (selector.exclude != null) {
      return m.call(element, selector.selector) && !m.call(element, selector.exclude);
    } else {
      return m.call(element, selector);
    }
  };

  var delegate = function(element, selector, eventType, handler) {
    return element.addEventListener(eventType, function(e) {
      var target;
      target = e.target;
      while (!(!(target instanceof Element) || matches(target, selector))) {
        target = target.parentNode;
      }
      if (target instanceof Element && handler.call(target, e) === false) {
        e.preventDefault();
        return e.stopPropagation();
      }
    });
  };

  var getPreviousSibling = function (elem, selector) {

    // Get the next sibling element
    var sibling = elem.previousElementSibling;

    // If there's no selector, return the first sibling
    if (!selector) return sibling;

    // If the sibling matches our selector, use it
    // If not, jump to the next sibling and continue the loop
    while (sibling) {
      if (sibling.matches(selector)) return sibling;
      sibling = sibling.previousElementSibling;
    }

  };

  window.CocoonHelper = { 
    CustomEvent, 
    fire,
    matches,
    delegate,
    getPreviousSibling
  }
  // end delegate
})();

(function({
  CustomEvent, 
  fire,
  matches,
  delegate,
  getPreviousSibling
}) {

  var cocoon_element_counter = 0;

  var create_new_id = function() {
    return (new Date().getTime() + cocoon_element_counter++);
  }

  var newcontent_braced = function(id) {
    return '[' + id + ']$1';
  }

  var newcontent_underscord = function(id) {
    return '_' + id + '_$1';
  }

  var getInsertionNodeElem = function(insertionNode, insertionTraversal, $this){

    if (!insertionNode){
      return $this.parentNode;
    }

    if (typeof insertionNode == 'function'){
      if(insertionTraversal){
        console.warn('association-insertion-traversal is ignored, because association-insertion-node is given as a function.')
      }
      return insertionNode($this);
    }

    if(typeof insertionNode == 'string'){
      if (insertionTraversal){
        return $this[insertionTraversal](insertionNode);
      }else{
        return insertionNode == "this" ? $this : insertionNode;
      }
    }

  }

  delegate(document, '.add_fields', 'click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var $this                 = this,
        assoc                 = $this.dataset.association,
        assocs                = $this.dataset.associations,
        content               = $this.dataset.associationInsertionTemplate,
        insertionMethod       = $this.dataset.associationInsertionMethod || $this.dataset.associationInsertionPosition || 'insertBefore',
        insertionNode         = $this.dataset.associationInsertionNode,
        insertionTraversal    = $this.dataset.associationInsertionTraversal,
        count                 = parseInt($this.dataset.count, 10),
        regexp_braced         = new RegExp('\\[new_' + assoc + '\\](.*?\\s)', 'g'),
        regexp_underscord     = new RegExp('_new_' + assoc + '_(\\w*)', 'g'),
        new_id                = create_new_id(),
        new_content           = content.replace(regexp_braced, newcontent_braced(new_id)),
        new_contents          = [],
        originalEvent         = e;


    if (new_content == content) {
      regexp_braced     = new RegExp('\\[new_' + assocs + '\\](.*?\\s)', 'g');
      regexp_underscord = new RegExp('_new_' + assocs + '_(\\w*)', 'g');
      new_content       = content.replace(regexp_braced, newcontent_braced(new_id));
    }

    new_content = new_content.replace(regexp_underscord, newcontent_underscord(new_id));
    new_contents = [new_content];

    count = (isNaN(count) ? 1 : Math.max(count, 1));
    count -= 1;

    while (count) {
      new_id      = create_new_id();
      new_content = content.replace(regexp_braced, newcontent_braced(new_id));
      new_content = new_content.replace(regexp_underscord, newcontent_underscord(new_id));
      new_contents.push(new_content);

      count -= 1;
    }

    var insertionNodeElem = getInsertionNodeElem(insertionNode, insertionTraversal, $this)

    if( !insertionNodeElem || (insertionNodeElem.length == 0) ){
      console.warn("Couldn't find the element to insert the template. Make sure your `data-association-insertion-*` on `link_to_add_association` is correct.")
    }

    new_contents.forEach(function(node, i) {
      var nodeObject = document.createElement('div');
      nodeObject.innerHTML = node;

      var contentNode = nodeObject.firstChild;

      before_insert = new CustomEvent('cocoon:before-insert', {
        bubbles: true,
        cancelable: true,
        detail: [contentNode, originalEvent]
      });

      insertionNodeElem.dispatchEvent(before_insert);


      if (!before_insert.defaultPrevented) {
        // allow any of the jquery dom manipulation methods (after, before, append, prepend, etc)
        // to be called on the node.  allows the insertion node to be the parent of the inserted
        // code and doesn't force it to be a sibling like after/before does. default: 'before'

        var addedContent = insertionNodeElem[insertionMethod](contentNode, $this);

        fire(insertionNodeElem, 'cocoon:after-insert', [contentNode,
          originalEvent])
      }
    });
  });

  delegate(document, '.remove_fields.dynamic, .remove_fields.existing', 'click', function(e) {
    var $this = this,
        wrapper_class = $this.dataset.wrapperClass || 'nested-fields',
        node_to_delete = $this.closest('.' + wrapper_class),
        trigger_node = node_to_delete.parentNode,
        originalEvent = e;

    e.preventDefault();
    e.stopPropagation();

    before_remove = new CustomEvent('cocoon:before-remove', {
      bubbles: true,
      cancelable: true,
      detail: [node_to_delete, originalEvent]
    });

    trigger_node.dispatchEvent(before_remove);

    if (!before_remove.defaultPrevented) {
      var timeout = trigger_node.dataset.removeTimeout || 0;

      setTimeout(function() {
        if ($this.classList.contains('dynamic')) {
            node_to_delete.remove();
        } else {
            getPreviousSibling($this, "input[type=hidden]").value = "1";
            node_to_delete.style.display = 'none';
        }
        fire(trigger_node, 'cocoon:after-remove', [node_to_delete,
          originalEvent]);
      }, timeout);
    }
  });


  var readyEvent = function() {
    document.querySelectorAll('.remove_fields.existing.destroyed').forEach(function(i, obj) {
      var wrapper_class = this.dataset.wrapperClass || 'nested-fields';
      this.closest('.' + wrapper_class).style.display = 'none';
    });
  };

  document.addEventListener('DOMContentLoaded', readyEvent, false);
  document.addEventListener('page:load', readyEvent, false);
  document.addEventListener('turbolinks:load', readyEvent, false);

})(window.CocoonHelper);


