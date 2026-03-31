from app.core.characters.stat_block import StatBlock


def test_stat_block_defaults():
    sb = StatBlock()
    assert sb.strength   == 0
    assert sb.endurance  == 0
    assert sb.power      == 0
    assert sb.resistance == 0
    assert sb.speed      == 0
    assert sb.precision  == 0


def test_stat_block_custom_values():
    sb = StatBlock(strength=50, endurance=40, power=30,
                   resistance=20, speed=80, precision=60)
    assert sb.strength   == 50
    assert sb.endurance  == 40
    assert sb.power      == 30
    assert sb.resistance == 20
    assert sb.speed      == 80
    assert sb.precision  == 60


def test_stat_block_partial_init():
    sb = StatBlock(speed=100)
    assert sb.speed     == 100
    assert sb.strength  == 0   # other stats remain at default
