import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { CodeEditor, CodeEditorControl, Language } from '@patternfly/react-code-editor';

import cockpit from 'cockpit';
import { CloseIcon, PlayIcon, SaveIcon } from '@patternfly/react-icons';
import { Button, CodeBlock, CodeBlockAction, CodeBlockCode } from '@patternfly/react-core';
import { Playbook } from './types';

const _ = cockpit.gettext;

export const Editor = ({ playbook }: { playbook: Playbook | null }) => {
    const [cockpitDarkMode, setCockpitDarkMode] = useState<boolean>(false);
    const [editedContent, setEditedContent] = useState<string>(playbook?.content || "");
    const [runningOutput, setRunningOutput] = useState<string>("");

    useEffect(() => {
        setEditedContent(playbook?.content || "");
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
            cockpit.spawn(["ansible-playbook", "--connection", "local", "--inventory", "127.0.0.1,", "--limit", "127.0.0.1", playbook.path], { err: "message", superuser: "try" })
                    .stream((data: string) => setRunningOutput((oldOutput) => oldOutput + data))
                    // @ts-expect-error: bad original typing
                    .catch((error, message) => {
                        console.log("Errored with:", error, message);
                    });
        }
    }, [setRunningOutput, playbook]);

    const onSaveContent = useCallback(async () => {
        if (playbook) {
            cockpit.file(playbook.path, { superuser: "try" }).replace(editedContent)
                    .then(tag => {
                        console.log(tag);
                    })
                    .catch(error => {
                        console.log(error);
                    });
        }
    }, [editedContent, playbook]);

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
                icon={<SaveIcon />}
                aria-label={_("Save playbook")}
                tooltipProps={{ content: _("Save playbook") }}
                onClick={onSaveContent}
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
                    headerMainContent={playbook?.path || ""}
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
