# Inserting into a singly linked list

Insertion changes links. Write the new link before overwriting the only pointer to the existing chain.

## At the beginning

The new node becomes the entry point. First connect it to the former first node, then update the head:

```c
new_node->next = head;
head = new_node;
```

If the insertion function must update the caller's head pointer, give it the address of that pointer. In C, a parameter of type `struct Node **` can write a new value into the caller's `struct Node *` variable.

## At the end

For a nonempty list, walk a cursor until it points to the last node, then connect that node to the new one:

```c
last->next = new_node;
new_node->next = NULL;
```

The empty-list case is different: there is no last node, so the new node becomes the head.

## Before changing links

1. Decide whether the list is empty.
2. Allocate a node and initialize its value and `next` pointer.
3. Preserve the existing chain before replacing a link.
4. Update `head` when the first node changes.
5. Release any removed node exactly once, after preserving the next address.
