"""D0.1 acceptance test — feature flag module."""

import importlib
import os


def _reload_flags():
    import agents.feature_flags as m
    importlib.reload(m)
    return m.flags


def test_all_flags_default_off():
    for key in (
        "ATLAS5_ORCHESTRATOR_V1",
        "ATLAS5_VIZ_ART_DIRECTOR_V1",
        "ATLAS5_GENERATIVE_VIZ_V1",
        "ATLAS5_FALSIFICATION_LANE_V1",
    ):
        os.environ.pop(key, None)

    f = _reload_flags()
    assert f.orchestrator_v1 is False
    assert f.viz_art_director_v1 is False
    assert f.generative_viz_v1 is False
    assert f.falsification_lane_v1 is False


def test_orchestrator_flag_on():
    os.environ["ATLAS5_ORCHESTRATOR_V1"] = "true"
    f = _reload_flags()
    assert f.orchestrator_v1 is True
    os.environ.pop("ATLAS5_ORCHESTRATOR_V1")


def test_flag_accepts_1_and_yes():
    for value in ("1", "yes", "YES", "True", "TRUE"):
        os.environ["ATLAS5_ORCHESTRATOR_V1"] = value
        f = _reload_flags()
        assert f.orchestrator_v1 is True, f"Expected True for value={value!r}"
    os.environ.pop("ATLAS5_ORCHESTRATOR_V1")


def test_flag_off_for_falsy_values():
    for value in ("false", "0", "no", "", "off"):
        os.environ["ATLAS5_ORCHESTRATOR_V1"] = value
        f = _reload_flags()
        assert f.orchestrator_v1 is False, f"Expected False for value={value!r}"
    os.environ.pop("ATLAS5_ORCHESTRATOR_V1")
