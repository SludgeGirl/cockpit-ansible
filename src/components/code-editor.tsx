import { Fragment, useCallback, useEffect, useState } from 'react';
import { CodeEditor, CodeEditorControl, Language } from '@patternfly/react-code-editor';

import cockpit from 'cockpit';
import React from 'react';
import { CloseIcon, PlayIcon, SaveIcon } from '@patternfly/react-icons';
import { Button, CodeBlock, CodeBlockAction, CodeBlockCode } from '@patternfly/react-core';

const _ = cockpit.gettext;

export const Editor = ({ playbook }: { playbook: Playbook | null }) => {
  const [cockpitDarkMode, setCockpitDarkMode] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>(playbook?.content || "");
  const [runningPlaybook, setRunningPlaybook] = useState<boolean>(false);
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
      console.log("darkModeEvent")
      DarkModeChecks();
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', darkModeEvent);

    DarkModeChecks();

    return () => {
      removeEventListener("change", darkModeEvent);
    };
  }, [DarkModeChecks]);

  const onEditorDidMount = (editor: any, monaco: any) => {
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
      setRunningPlaybook(true);
      setRunningOutput("");
      console.log("Running: ", ["ansible-playbook", "--connection", "local", "--inventory", "127.0.0.1,", "--limit", "127.0.0.1", playbook.path].join(" "))
      cockpit.spawn(["ansible-playbook", "--connection", "local", "--inventory", "127.0.0.1,", "--limit", "127.0.0.1", playbook.path], { err: "message", superuser: "try" })
        .stream((data: string) => setRunningOutput((oldOutput) => oldOutput + data))
        .catch((error, message) => {
          console.log("Errored with:", error, message);
        })
        .finally(() => {
          setRunningPlaybook(false);
        });
    }
  }, [setRunningPlaybook, setRunningOutput, runningOutput, playbook]);

  const onSaveContent = useCallback(async () => {
    if (playbook) {
      cockpit.file(playbook.path, { superuser: "try" }).replace(editedContent)
        .then(tag => {
          console.log(tag);
        })
        .catch(error => {
          console.log(error);
        })
    }
  }, [editedContent]);

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
    <Fragment>
      <CodeBlockAction>
        <Button
          variant="plain"
          aria-label="Run in web terminal"
          icon={<CloseIcon />}
          onClick={() => setRunningOutput("")}
        />
      </CodeBlockAction>
    </Fragment>
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
      {runningOutput ? 
        <CodeBlock actions={resultsActions}>
          <CodeBlockCode id="code-content">{runningOutput}</CodeBlockCode>
        </CodeBlock> : <></>}
    </>
  );
};
