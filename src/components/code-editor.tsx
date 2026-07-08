import React, { useCallback, useEffect, useState } from 'react';
import { CodeEditor, CodeEditorControl, Language } from '@patternfly/react-code-editor';

import cockpit from 'cockpit';
import { CloseIcon, CodeIcon, PlayIcon, SaveIcon } from '@patternfly/react-icons';
import { ActionGroup, Button, CodeBlock, CodeBlockAction, CodeBlockCode, Form, Grid, GridItem, Modal, ModalBody, ModalHeader, TextInput } from '@patternfly/react-core';
import { Playbook } from './types';

import { useDialogs } from 'dialogs';

const _ = cockpit.gettext;

type VariableRow = {
    name: string,
    value: string,
};

const VariableFormPopup = ({ callback, existingVariables }: {callback: (variables: VariableRow[]) => Promise<boolean>, existingVariables: VariableRow[]}) => {
    const Dialogs = useDialogs();
    const [variables, setVariables] = useState<VariableRow[]>(existingVariables);

    const onValueChange = (row: number, fieldName: keyof VariableRow, value: string) => {
        setVariables(variables.map((row_values, row_index) => {
            if (row_index === row) {
                console.log("row_index, row:", row_index, row);
                console.log("row_values, [fieldName]: value", row_values, { [fieldName]: value });
                return { ...row_values, [fieldName]: value };
            } else {
                return row_values;
            }
        }));
    };

    useEffect(() => {
        console.log(variables);
    }, [variables]);

    const submit = () => {
        console.log("submitting");
        callback(variables)
                .finally(() => {
                    Dialogs.close();
                });
    };

    return (
        <Modal
            title={_("Edit Variables")}
            variant="medium"
            onClose={() => Dialogs.close()}
            isOpen
        >
            <ModalHeader title={_("Edit Variables")} />
            <ModalBody>
                <Form>
                    {variables.map((item, index) => {
                        console.log("rendering row", item, index);
                        return (
                            <Grid hasGutter md={4} key={"variable-row-" + index}>
                                <GridItem span={5}>
                                    <TextInput
                                        id={"variable-row-" + index + "-name"}
                                        onChange={(_, value) => onValueChange(index, "name", value)}
                                        value={item.name}
                                    />
                                </GridItem>
                                <GridItem span={5}>
                                    <TextInput
                                        id={"variable-row-" + index + "-value"}
                                        onChange={(_, value) => onValueChange(index, "value", value)}
                                        value={item.value}
                                    />
                                </GridItem>
                                <GridItem span={2}>
                                    remove
                                </GridItem>
                            </Grid>
                        );
                    })}
                    <GridItem span={12}>
                        <ActionGroup>
                            <Button onClick={submit} variant="primary">{_("Save Variables")}</Button>
                            <Button onClick={() => setVariables([...variables, { name: "", value: "" }])} variant="secondary">{_("Add Variable")}</Button>
                        </ActionGroup>
                    </GridItem>
                </Form>
            </ModalBody>
        </Modal>
    );
};

export const Editor = ({ playbook, update_playbooks }: { playbook: Playbook | null, update_playbooks: () => void }) => {
    const Dialogs = useDialogs();

    const [cockpitDarkMode, setCockpitDarkMode] = useState<boolean>(false);
    const [editedContent, setEditedContent] = useState<string>(playbook?.content || "");
    const [runningOutput, setRunningOutput] = useState<string>("");
    const [runtimeVariables, setRuntimeVariables] = useState<VariableRow[]>([]);

    useEffect(() => {
        setEditedContent(playbook?.content || "");
        if (playbook) {
            const first_line = playbook.content.split("\n")[0] || "";
            const variables = JSON.parse(first_line.split("# saved_variables: ")[1] || '[]');
            console.log("found variables:", variables);
            setRuntimeVariables(variables);
        }
    }, [playbook]);

    const DarkModeChecks = useCallback(() => {
        const style = localStorage.getItem('shell:style') || 'auto';
        if ((window.matchMedia?.('(prefers-color-scheme: dark)').matches && style === "auto") || style === "dark") {
            setCockpitDarkMode(true);
        } else {
            setCockpitDarkMode(false);
        }
    }, [setCockpitDarkMode]);

    useEffect(() => {
        const darkModeEvent = () => {
            console.log("darkModeEvent");
            DarkModeChecks();
        };
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', darkModeEvent);

        DarkModeChecks();

        return () => {
            removeEventListener("change", darkModeEvent);
        };
    }, [DarkModeChecks]);

    // @ts-expect-error: editor and monaco are generic
    const onEditorDidMount = (editor, monaco) => {
        editor.layout();
        editor.focus();
        monaco.editor.getModels()[0].updateOptions({ tabSize: 5 });
    };

    const onChange = useCallback((value: string) => {
        // eslint-disable-next-line no-console
        setEditedContent(value);
    }, [setEditedContent]);

    const onExecuteCode = useCallback(() => {
        if (playbook) {
            setRunningOutput("");
            const variables = JSON.stringify(runtimeVariables.map(item => {
                return { [item.name]: item.value };
            }).reduce((a, b) => {
                return { ...a, ...b };
            }));
            cockpit.spawn(["ansible-playbook", "--connection", "local", "--inventory", "127.0.0.1,", "--limit", "127.0.0.1", playbook.path, "--extra-vars", variables], { err: "message", superuser: "try" })
                    .stream((data: string) => setRunningOutput((oldOutput) => oldOutput + data))
                    // @ts-expect-error: bad original typing
                    .catch((error, message) => {
                        console.log("Errored with:", error, message);
                        // setRunningOutput(error.message);
                    });
        }
    }, [setRunningOutput, playbook, runtimeVariables]);

    const onSaveContent = useCallback((runtime_variables: VariableRow[] | null = null) => {
        console.log("Saving", playbook);
        const variables = runtime_variables || runtimeVariables;
        console.log("Saving variables", variables);
        if (playbook) {
            let content = editedContent;
            if (variables) {
                const content_parts = content.split("\n");
                if (content_parts[0].includes("# saved_variables:")) {
                    content_parts.shift();
                }
                content = "# saved_variables: " + JSON.stringify(variables) + "\n" + content_parts.join("\n");
                playbook.content = content;
            }
            cockpit.file("/var/lib/ansible/playbooks/" + playbook.script_name, { superuser: "try" }).replace(content)
                    .catch(error => {
                        console.log(error);
                    })
                    .finally(() => {
                        update_playbooks();
                        setEditedContent(content);
                    });
        }
    }, [editedContent, playbook, update_playbooks, runtimeVariables]);

    const editVariablesSubmission = useCallback((variables: VariableRow[]) => {
        console.log("editVariablesSubmission", variables);
        setRuntimeVariables(variables);
        onSaveContent(variables);
    }, [setRuntimeVariables, onSaveContent]);

    const onEditVariables = useCallback(() => {
        Dialogs.show(
            <VariableFormPopup
                existingVariables={runtimeVariables}
                callback={(variables: VariableRow[]) => {
                    editVariablesSubmission(variables);
                    return new Promise((resolve) => { resolve(true) });
                } }
            />
        );
    }, [Dialogs, editVariablesSubmission, runtimeVariables]);

    const controls = (
        <>
            <CodeEditorControl
                icon={<PlayIcon />}
                aria-label={_("Run playbook")}
                tooltipProps={{ content: _("Run playbook") }}
                onClick={onExecuteCode}
                isVisible={playbook?.content !== ''}
            />
            <CodeEditorControl
                icon={<CodeIcon />}
                aria-label={_("Edit variables")}
                tooltipProps={{ content: _("Edit variables") }}
                onClick={onEditVariables}
                isVisible={playbook?.content !== ''}
            />
            <CodeEditorControl
                icon={<SaveIcon />}
                aria-label={_("Save playbook")}
                tooltipProps={{ content: _("Save playbook") }}
                onClick={() => onSaveContent}
                isVisible={playbook?.content !== ''}
            />
        </>
    );

    const resultsActions = (
        <CodeBlockAction>
            <Button
                variant="plain"
                aria-label="Run in web terminal"
                icon={<CloseIcon />}
                onClick={() => setRunningOutput("")}
            />
        </CodeBlockAction>
    );

    return (
        <>
            <div style={runningOutput ? { display: "none" } : {}}>
                <CodeEditor
                    headerMainContent={(playbook?.path || "") + ((playbook?.parent_playbook || "") && " (modified)")}
                    isLanguageLabelVisible
                    isDarkTheme={cockpitDarkMode}
                    customControls={controls}
                    code={editedContent}
                    onChange={onChange}
                    language={Language.yaml}
                    onEditorDidMount={onEditorDidMount}
                    height="400px"
                />
            </div>
            {runningOutput &&
                <CodeBlock actions={resultsActions}>
                    <CodeBlockCode id="code-content">{runningOutput}</CodeBlockCode>
                </CodeBlock>}
        </>
    );
};
