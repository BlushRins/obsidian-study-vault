# Linked-list nodes in C

A singly linked list is a chain of separately allocated nodes. Each node stores a value and the address of the next node. The final node uses a null pointer to mark the end.

```c
struct Node {
    int value;
    struct Node *next;
};
```

A pointer to the first node is the list's entry point. An empty list has no first node:

```c
struct Node *head = NULL;
```

To connect nodes, set each node's `next` pointer to the following node. Preserve a pointer to the first node so the rest of the chain stays reachable. Walking the list uses a separate cursor:

```c
for (struct Node *cursor = head; cursor != NULL; cursor = cursor->next) {
    /* inspect cursor->value */
}
```

Dynamically allocated nodes remain allocated until the program releases them with `free`. Before freeing a node, save its `next` pointer so traversal can continue. Never dereference a pointer after freeing its node.

## Quick checks

- Empty list: `head == NULL`.
- One-node list: `head->next == NULL`.
- End of list: the current node's `next == NULL`.
- If changing the first node, update the caller's `head` pointer.
