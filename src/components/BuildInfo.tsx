interface Props {
  version?: string
  build?: string
  previewBranch?: string | null
  previewPrUrl?: string | null
}

/** Footer line naming the running build, flagged as a preview on preview deployments. */
export function BuildInfo({
  version = __APP_VERSION__,
  build = __BUILD_ID__,
  previewBranch = __PREVIEW_BRANCH__,
  previewPrUrl = __PREVIEW_PR_URL__,
}: Props) {
  if (!previewBranch) return <>{version} · {build}</>
  // Previews never carry a release tag, so the branch takes the version's place.
  const branch = <span className="break-all">{previewBranch}</span>
  return (
    <>
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Preview</span>{' '}
      {previewPrUrl ? (
        <a href={previewPrUrl} className="underline" target="_blank" rel="noreferrer">{branch}</a>
      ) : branch}{' '}
      · {build}
    </>
  )
}
