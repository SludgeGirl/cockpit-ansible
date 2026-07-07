export type Playbook = {
    path: string,
    script_name: string,
    content: string,
    output: string,
    parent_playbook: Playbook | null
};
